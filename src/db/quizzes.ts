import { db } from './index.ts';
import { quizzes, questions, quizAttempts, topicProgress } from './schema.ts';
import { eq, and, desc } from 'drizzle-orm';

export async function getQuizzesBySubject(userId: string, subjectId: number) {
  try {
    const list = await db
      .select()
      .from(quizzes)
      .where(and(eq(quizzes.userId, userId), eq(quizzes.subjectId, subjectId)))
      .orderBy(desc(quizzes.createdAt));

    // Get attempt count and best score
    const withStats = await Promise.all(
      list.map(async (q) => {
        const attempts = await db
          .select()
          .from(quizAttempts)
          .where(and(eq(quizAttempts.userId, userId), eq(quizAttempts.quizId, q.id)))
          .orderBy(desc(quizAttempts.completedAt));

        const bestScore = attempts.length > 0 ? Math.max(...attempts.map((a) => Number(a.score))) : null;

        return {
          ...q,
          attemptsCount: attempts.length,
          bestScore,
          lastAttempt: attempts[0] || null,
        };
      }),
    );

    return withStats;
  } catch (error) {
    console.error('Error fetching quizzes:', error);
    throw new Error('Failed to fetch quizzes', { cause: error });
  }
}

export async function getQuizById(userId: string, quizId: number, includeAnswers: boolean = false) {
  try {
    const [quiz] = await db
      .select()
      .from(quizzes)
      .where(and(eq(quizzes.id, quizId), eq(quizzes.userId, userId)))
      .limit(1);

    if (!quiz) return null;

    const questionList = await db
      .select()
      .from(questions)
      .where(eq(questions.quizId, quizId));

    const formattedQuestions = questionList.map((q) => {
      if (!includeAnswers) {
        // Hide correct option during active quiz taking
        const { correctOptionIndex, explanation, ...rest } = q;
        return rest;
      }
      return q;
    });

    return {
      ...quiz,
      questions: formattedQuestions,
    };
  } catch (error) {
    console.error('Error getting quiz by id:', error);
    throw new Error('Failed to retrieve quiz', { cause: error });
  }
}

export async function createQuizWithQuestions(
  userId: string,
  subjectId: number,
  materialId: number | null,
  data: {
    title: string;
    difficulty: string;
    questions: Array<{
      questionText: string;
      topicTag: string;
      options: string[];
      correctOptionIndex: number;
      explanation: string;
    }>;
  },
) {
  try {
    const [createdQuiz] = await db
      .insert(quizzes)
      .values({
        userId,
        subjectId,
        materialId: materialId || null,
        title: data.title,
        difficulty: data.difficulty,
        totalQuestions: data.questions.length,
      })
      .returning();

    await db.insert(questions).values(
      data.questions.map((q) => ({
        quizId: createdQuiz.id,
        questionText: q.questionText,
        topicTag: q.topicTag || 'General',
        options: q.options,
        correctOptionIndex: q.correctOptionIndex,
        explanation: q.explanation,
      })),
    );

    return createdQuiz;
  } catch (error) {
    console.error('Error creating quiz with questions:', error);
    throw new Error('Failed to save generated quiz', { cause: error });
  }
}

export async function submitQuizAttempt(
  userId: string,
  quizId: number,
  userSelections: Array<{ questionId: number; selectedIndex: number }>,
  timeTakenSeconds: number = 0,
) {
  try {
    const [quiz] = await db
      .select()
      .from(quizzes)
      .where(and(eq(quizzes.id, quizId), eq(quizzes.userId, userId)))
      .limit(1);

    if (!quiz) throw new Error('Quiz not found');

    const dbQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.quizId, quizId));

    let correctCount = 0;
    const evaluatedAnswers: Array<{
      questionId: number;
      selectedIndex: number;
      correctIndex: number;
      isCorrect: boolean;
      topicTag: string;
      explanation: string;
    }> = [];

    const topicStats: Record<string, { total: number; correct: number }> = {};

    for (const q of dbQuestions) {
      const userChoice = userSelections.find((s) => s.questionId === q.id);
      const selectedIndex = userChoice !== undefined ? userChoice.selectedIndex : -1;
      const isCorrect = selectedIndex === q.correctOptionIndex;

      if (isCorrect) correctCount++;

      evaluatedAnswers.push({
        questionId: q.id,
        selectedIndex,
        correctIndex: q.correctOptionIndex,
        isCorrect,
        topicTag: q.topicTag,
        explanation: q.explanation,
      });

      if (!topicStats[q.topicTag]) {
        topicStats[q.topicTag] = { total: 0, correct: 0 };
      }
      topicStats[q.topicTag].total += 1;
      if (isCorrect) topicStats[q.topicTag].correct += 1;
    }

    const totalAnswered = userSelections.length;
    const totalQuestions = dbQuestions.length;
    const score = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

    const [attempt] = await db
      .insert(quizAttempts)
      .values({
        userId,
        quizId,
        score: score.toFixed(2),
        totalAnswered,
        correctAnswers: correctCount,
        userAnswers: evaluatedAnswers.map((ea) => ({
          questionId: ea.questionId,
          selectedIndex: ea.selectedIndex,
          isCorrect: ea.isCorrect,
        })),
        timeTakenSeconds,
      })
      .returning();

    // Update topic progress in background / concurrently
    for (const [topic, stats] of Object.entries(topicStats)) {
      const [existing] = await db
        .select()
        .from(topicProgress)
        .where(
          and(
            eq(topicProgress.userId, userId),
            eq(topicProgress.subjectId, quiz.subjectId),
            eq(topicProgress.topicName, topic),
          ),
        )
        .limit(1);

      if (existing) {
        const newTotal = existing.totalQuestionsAttempted + stats.total;
        const newCorrect = existing.totalCorrect + stats.correct;
        const pct = (newCorrect / newTotal) * 100;
        const status = pct >= 80 ? 'mastered' : pct >= 60 ? 'improving' : 'needs_focus';

        await db
          .update(topicProgress)
          .set({
            totalQuestionsAttempted: newTotal,
            totalCorrect: newCorrect,
            masteryStatus: status,
            lastPracticedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(topicProgress.id, existing.id));
      } else {
        const pct = (stats.correct / stats.total) * 100;
        const status = pct >= 80 ? 'mastered' : pct >= 60 ? 'improving' : 'needs_focus';

        await db.insert(topicProgress).values({
          userId,
          subjectId: quiz.subjectId,
          topicName: topic,
          totalQuestionsAttempted: stats.total,
          totalCorrect: stats.correct,
          masteryStatus: status,
          lastPracticedAt: new Date(),
        });
      }
    }

    return {
      attempt,
      score,
      totalQuestions,
      correctCount,
      evaluatedAnswers,
    };
  } catch (error) {
    console.error('Error submitting quiz attempt:', error);
    throw new Error('Failed to submit quiz attempt', { cause: error });
  }
}
