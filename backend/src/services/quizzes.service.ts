import { eq, and, desc } from 'drizzle-orm';
import { db, isDbActive } from '../config/database.ts';
import { quizzes, questions, quizAttempts, topicProgress } from '../models/schema.ts';
import { materialsService } from './materials.service.ts';
import { subjectsService } from './subjects.service.ts';
import { aiService, GeneratedQuestion } from './ai.service.ts';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors.ts';
import { logger } from '../utils/logger.ts';

const memoryQuizzes = new Map<number, any>();
const memoryQuestions = new Map<number, any[]>();
const memoryAttempts = new Map<number, any[]>();
let nextQuizId = 300;
let nextAttemptId = 1000;

export interface GenerateQuizInput {
  subjectId: number;
  materialId: number;
  count?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface UserAnswerInput {
  questionId: number;
  selectedIndex: number;
}

export const quizzesService = {
  async generateQuiz(userId: string, data: GenerateQuizInput) {
    // 1. Authorize subject and material ownership
    await subjectsService.getSubjectById(userId, data.subjectId);
    const material = await materialsService.getMaterialById(userId, data.materialId);

    const questionCount = Math.min(Math.max(Number(data.count) || 5, 1), 20);
    const difficulty = data.difficulty || 'medium';

    // 2. Call AI to generate structured multiple-choice questions
    const generatedQuestions: GeneratedQuestion[] = await aiService.generateQuizQuestions(
      material.title,
      material.rawText,
      questionCount,
      difficulty,
    );

    if (isDbActive()) {
      try {
        const [quiz] = await db
          .insert(quizzes)
          .values({
            userId,
            subjectId: data.subjectId,
            materialId: data.materialId,
            title: `${material.title} Practice Quiz`,
            difficulty,
            totalQuestions: generatedQuestions.length,
          })
          .returning();

        const createdQuestions = await db
          .insert(questions)
          .values(
            generatedQuestions.map((q: any) => ({
              quizId: quiz.id,
              questionText: q.questionText || q.question,
              topicTag: q.topicTag || q.topic || 'General',
              options: q.options,
              correctOptionIndex:
                typeof q.correctOptionIndex === 'number'
                  ? q.correctOptionIndex
                  : typeof q.correctAnswerIndex === 'number'
                  ? q.correctAnswerIndex
                  : 0,
              explanation: q.explanation || '',
            })),
          )
          .returning();

        memoryQuizzes.set(quiz.id, quiz);
        memoryQuestions.set(quiz.id, createdQuestions);

        return {
          ...quiz,
          questions: createdQuestions,
        };
      } catch (err: any) {
        logger.debug(`Postgres generateQuiz notice: ${err.message}`);
      }
    }

    const newQuiz = {
      id: ++nextQuizId,
      userId,
      subjectId: data.subjectId,
      materialId: data.materialId,
      title: `${material.title} Practice Quiz`,
      difficulty,
      totalQuestions: generatedQuestions.length,
      createdAt: new Date(),
    };

    const qs = generatedQuestions.map((q: any, idx) => ({
      id: newQuiz.id * 100 + idx,
      quizId: newQuiz.id,
      questionText: q.questionText || q.question,
      topicTag: q.topicTag || q.topic || 'General',
      options: q.options,
      correctOptionIndex:
        typeof q.correctOptionIndex === 'number'
          ? q.correctOptionIndex
          : typeof q.correctAnswerIndex === 'number'
          ? q.correctAnswerIndex
          : 0,
      explanation: q.explanation || '',
    }));

    memoryQuizzes.set(newQuiz.id, newQuiz);
    memoryQuestions.set(newQuiz.id, qs);

    return {
      ...newQuiz,
      questions: qs,
    };
  },

  async getQuizzes(userId: string, subjectId?: number) {
    if (isDbActive()) {
      try {
        const conditions = [eq(quizzes.userId, userId)];
        if (subjectId) {
          conditions.push(eq(quizzes.subjectId, subjectId));
        }

        const list = await db
          .select()
          .from(quizzes)
          .where(and(...conditions))
          .orderBy(desc(quizzes.createdAt));

        return list;
      } catch (err: any) {
        logger.debug(`Postgres getQuizzes notice: ${err.message}`);
      }
    }

    let list = Array.from(memoryQuizzes.values()).filter((q) => q.userId === userId);
    if (subjectId) {
      list = list.filter((q) => q.subjectId === subjectId);
    }
    return list;
  },

  async getQuizById(userId: string, quizId: number, includeAnswers: boolean = false) {
    if (isDbActive()) {
      try {
        const [quiz] = await db
          .select()
          .from(quizzes)
          .where(eq(quizzes.id, quizId))
          .limit(1);

        if (quiz) {
          // Security check: Authorize by user ID
          if (quiz.userId !== userId) {
            throw new ForbiddenError('You do not have permission to access this quiz');
          }

          const rawQuestions = await db
            .select()
            .from(questions)
            .where(eq(questions.quizId, quizId))
            .orderBy(questions.id);

          const formattedQuestions = rawQuestions.map((q) => {
            if (!includeAnswers) {
              const { correctOptionIndex: _, explanation: __, ...safeQ } = q;
              return safeQ;
            }
            return q;
          });

          return {
            ...quiz,
            questions: formattedQuestions,
          };
        }
      } catch (err: any) {
        if (err instanceof ForbiddenError) throw err;
        logger.debug(`Postgres getQuizById notice: ${err.message}`);
      }
    }

    const memQuiz = memoryQuizzes.get(quizId);
    if (!memQuiz) throw new NotFoundError('Quiz not found');
    if (memQuiz.userId !== userId) throw new ForbiddenError('You do not have permission to access this quiz');

    const rawQs = memoryQuestions.get(quizId) || [];
    const formatted = rawQs.map((q) => {
      if (!includeAnswers) {
        const { correctOptionIndex: _, explanation: __, ...safeQ } = q;
        return safeQ;
      }
      return q;
    });

    return {
      ...memQuiz,
      questions: formatted,
    };
  },

  async submitQuiz(
    userId: string,
    quizId: number,
    userSelections: UserAnswerInput[],
    timeTakenSeconds: number = 0,
  ) {
    // 1. Authorize ownership and retrieve full quiz with true answers
    const quiz = await this.getQuizById(userId, quizId, true);
    const quizQuestions: any[] = (quiz as any).questions || [];

    if (quizQuestions.length === 0) {
      throw new BadRequestError('Quiz has no questions to grade');
    }

    // 2. Grade each question
    let correctCount = 0;
    const gradedSelections = quizQuestions.map((q) => {
      const userSel = userSelections.find((s) => s.questionId === q.id);
      const selectedIndex = userSel ? userSel.selectedIndex : -1;
      const isCorrect = selectedIndex === q.correctOptionIndex;

      if (isCorrect) correctCount++;

      return {
        questionId: q.id,
        questionText: q.questionText,
        topicTag: q.topicTag,
        selectedIndex,
        correctOptionIndex: q.correctOptionIndex,
        isCorrect,
        explanation: q.explanation,
      };
    });

    const totalAnswered = userSelections.length;
    const score = Number(((correctCount / quizQuestions.length) * 100).toFixed(2));

    if (isDbActive()) {
      try {
        // 3. Record attempt in database
        const [attempt] = await db
          .insert(quizAttempts)
          .values({
            userId,
            quizId,
            score: score.toString(),
            totalAnswered,
            correctAnswers: correctCount,
            userAnswers: gradedSelections.map((g) => ({
              questionId: g.questionId,
              selectedIndex: g.selectedIndex,
              isCorrect: g.isCorrect,
            })),
            timeTakenSeconds,
          })
          .returning();

        // 4. Update topic progress asynchronously
        for (const g of gradedSelections) {
          if (g.topicTag) {
            try {
              const [existing] = await db
                .select()
                .from(topicProgress)
                .where(
                  and(
                    eq(topicProgress.userId, userId),
                    eq(topicProgress.subjectId, quiz.subjectId),
                    eq(topicProgress.topicName, g.topicTag),
                  ),
                )
                .limit(1);

              const newTotal = (existing?.totalQuestionsAttempted || 0) + 1;
              const newCorrect = (existing?.totalCorrect || 0) + (g.isCorrect ? 1 : 0);
              const accuracy = (newCorrect / newTotal) * 100;
              const masteryStatus =
                accuracy >= 80 ? 'mastered' : accuracy >= 50 ? 'practicing' : 'needs_focus';

              if (existing) {
                await db
                  .update(topicProgress)
                  .set({
                    totalQuestionsAttempted: newTotal,
                    totalCorrect: newCorrect,
                    masteryStatus,
                    lastPracticedAt: new Date(),
                    updatedAt: new Date(),
                  })
                  .where(eq(topicProgress.id, existing.id));
              } else {
                await db.insert(topicProgress).values({
                  userId,
                  subjectId: quiz.subjectId,
                  topicName: g.topicTag,
                  totalQuestionsAttempted: newTotal,
                  totalCorrect: newCorrect,
                  masteryStatus,
                });
              }
            } catch {
              // Ignore topic update error if table is locked or updating
            }
          }
        }

        return {
          attemptId: attempt?.id || 1,
          score,
          totalQuestions: quizQuestions.length,
          correctAnswers: correctCount,
          gradedSelections,
          timeTakenSeconds,
          completedAt: new Date(),
        };
      } catch (err: any) {
        logger.debug(`Postgres submitQuiz notice: ${err.message}`);
      }
    }

    const fallbackAttempt = {
      id: ++nextAttemptId,
      attemptId: nextAttemptId,
      userId,
      quizId,
      score,
      totalAnswered: userSelections.length,
      totalQuestions: quizQuestions.length,
      correctAnswers: correctCount,
      gradedSelections,
      timeTakenSeconds,
      completedAt: new Date(),
    };
    const existing = memoryAttempts.get(quizId) || [];
    existing.push(fallbackAttempt);
    memoryAttempts.set(quizId, existing);

    return fallbackAttempt;
  },

  async getQuizAttempts(userId: string) {
    if (isDbActive()) {
      try {
        const list = await db
          .select()
          .from(quizAttempts)
          .where(eq(quizAttempts.userId, userId))
          .orderBy(desc(quizAttempts.completedAt))
          .limit(20);
        if (list && list.length > 0) return list;
      } catch (err: any) {
        logger.debug(`Postgres getQuizAttempts notice: ${err.message}`);
      }
    }
    const memList: any[] = [];
    for (const [_, atts] of memoryAttempts) {
      memList.push(...atts.filter((a: any) => a.userId === userId));
    }
    return memList.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  },

  async deleteQuiz(userId: string, quizId: number) {
    // 1. Authorize ownership
    await this.getQuizById(userId, quizId);

    if (isDbActive()) {
      try {
        await db
          .delete(quizzes)
          .where(and(eq(quizzes.id, quizId), eq(quizzes.userId, userId)));
        memoryQuizzes.delete(quizId);
        memoryQuestions.delete(quizId);
        memoryAttempts.delete(quizId);
        return { success: true, message: 'Quiz deleted successfully' };
      } catch (err: any) {
        logger.debug(`Postgres deleteQuiz notice: ${err.message}`);
      }
    }

    memoryQuizzes.delete(quizId);
    memoryQuestions.delete(quizId);
    memoryAttempts.delete(quizId);
    return { success: true, message: 'Quiz deleted successfully' };
  },
};
