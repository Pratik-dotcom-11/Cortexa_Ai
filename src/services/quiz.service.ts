import { Quiz, Question, QuizAttempt, ApiResponse } from '../types';
import { storage } from './storage';

export const quizService = {
  async getQuizzes(subjectId?: string): Promise<ApiResponse<Quiz[]>> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    let quizzes = storage.getQuizzes();
    if (subjectId) {
      quizzes = quizzes.filter((q) => q.subjectId === subjectId);
    }
    return { success: true, data: quizzes };
  },

  async getQuizById(id: string): Promise<ApiResponse<Quiz | null>> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const quizzes = storage.getQuizzes();
    const found = quizzes.find((q) => q.id === id);
    if (!found) return { success: false, data: null, error: 'Quiz not found' };
    return { success: true, data: found };
  },

  async generateQuiz(params: {
    subjectId: string;
    materialId?: string;
    topicName?: string;
    difficulty: 'easy' | 'medium' | 'hard';
    questionCount: number;
  }): Promise<ApiResponse<Quiz>> {
    await new Promise((resolve) => setTimeout(resolve, 800)); // Simulating AI processing
    const user = storage.getUser();
    const quizId = `quiz-${Date.now().toString(36)}`;
    const topic = params.topicName || 'Key Concepts';

    // Formulate realistic contextual questions based on the topic & material
    const sampleQuestions: Question[] = [
      {
        id: `q-${quizId}-1`,
        quizId,
        questionText: `Which principle is most critical when evaluating ${topic}?`,
        topicTag: topic,
        options: [
          'Linear scaling with zero variance overhead',
          'Invariant constraints and boundary edge condition validation',
          'Recursive stack unwinding without memoization',
          'Randomized approximate heuristic bounds',
        ],
        correctOptionIndex: 1,
        explanation: `Under ${topic}, invariant constraints and boundary conditions guarantee correctness across edge states.`,
      },
      {
        id: `q-${quizId}-2`,
        quizId,
        questionText: `What is the primary trade-off associated with optimizing ${topic}?`,
        topicTag: topic,
        options: [
          'Increased memory footprint in exchange for faster access time',
          'Loss of deterministic guarantees across all inputs',
          'Mandatory multi-threading synchronization barriers',
          'Loss of compiler optimizations',
        ],
        correctOptionIndex: 0,
        explanation: 'Space-time trade-offs are fundamental: auxiliary tables/caches reduce runtime at the cost of additional memory.',
      },
      {
        id: `q-${quizId}-3`,
        quizId,
        questionText: `When applying ${topic} in production, what failure mode should be monitored first?`,
        topicTag: topic,
        options: [
          'Immediate compiler syntax rejection',
          'Worst-case input degradation exceeding expected bounds',
          'Hardware floating-point rounding underflow only',
          'Garbage collector heap lock',
        ],
        correctOptionIndex: 1,
        explanation: 'Pathological or adversarial inputs can trigger worst-case performance bounds if not properly safeguarded.',
      },
    ];

    // Trim or expand to requested questionCount
    const questions = sampleQuestions.slice(0, Math.min(params.questionCount, sampleQuestions.length));

    const newQuiz: Quiz = {
      id: quizId,
      userId: user?.id || 'usr-student-01',
      subjectId: params.subjectId,
      materialId: params.materialId,
      title: `${topic} Practice Quiz (${params.difficulty.toUpperCase()})`,
      difficulty: params.difficulty,
      totalQuestions: questions.length,
      questions,
      createdAt: new Date().toISOString(),
    };

    const quizzes = storage.getQuizzes();
    quizzes.unshift(newQuiz);
    storage.setQuizzes(quizzes);

    return {
      success: true,
      data: newQuiz,
      message: 'Quiz generated successfully',
    };
  },

  async submitQuiz(params: {
    quizId: string;
    answers: { questionId: string; selectedOptionIndex: number }[];
    timeTakenSeconds: number;
  }): Promise<ApiResponse<QuizAttempt>> {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const user = storage.getUser();
    const quizzes = storage.getQuizzes();
    const quiz = quizzes.find((q) => q.id === params.quizId);

    if (!quiz) {
      return { success: false, data: null as any, error: 'Quiz not found' };
    }

    let correctCount = 0;
    const evaluatedAnswers = params.answers.map((ans) => {
      const q = quiz.questions.find((quest) => quest.id === ans.questionId);
      const isCorrect = q ? q.correctOptionIndex === ans.selectedOptionIndex : false;
      if (isCorrect) correctCount++;
      return {
        questionId: ans.questionId,
        selectedOptionIndex: ans.selectedOptionIndex,
        isCorrect,
      };
    });

    const total = quiz.questions.length || 1;
    const score = Math.round((correctCount / total) * 100);

    const attempt: QuizAttempt = {
      id: `att-${Date.now().toString(36)}`,
      quizId: quiz.id,
      userId: user?.id || 'usr-student-01',
      quizTitle: quiz.title,
      subjectId: quiz.subjectId,
      score,
      correctAnswers: correctCount,
      totalQuestions: total,
      userAnswers: evaluatedAnswers,
      timeTakenSeconds: params.timeTakenSeconds,
      completedAt: new Date().toISOString(),
    };

    // Save attempt
    const attempts = storage.getAttempts();
    attempts.unshift(attempt);
    storage.setAttempts(attempts);

    // Update quiz last score
    quiz.lastAttemptScore = score;
    storage.setQuizzes(quizzes);

    // Update Topic Progress (Analytics & Weak Topic Detection)
    const topicProgress = storage.getTopicProgress();
    quiz.questions.forEach((q) => {
      const isCorrect = evaluatedAnswers.find((a) => a.questionId === q.id)?.isCorrect || false;
      const existingProg = topicProgress.find(
        (tp) => tp.subjectId === quiz.subjectId && tp.topicName.toLowerCase() === q.topicTag.toLowerCase(),
      );

      if (existingProg) {
        existingProg.totalQuestionsAttempted += 1;
        if (isCorrect) existingProg.totalCorrect += 1;
        existingProg.accuracyPercentage = Math.round(
          (existingProg.totalCorrect / existingProg.totalQuestionsAttempted) * 100,
        );
        existingProg.masteryStatus =
          existingProg.accuracyPercentage >= 80
            ? 'mastered'
            : existingProg.accuracyPercentage >= 60
            ? 'improving'
            : 'needs_focus';
        existingProg.lastPracticedAt = new Date().toISOString();
      } else {
        topicProgress.push({
          id: `tp-${Date.now().toString(36)}`,
          userId: user?.id || 'usr-student-01',
          subjectId: quiz.subjectId,
          topicName: q.topicTag,
          totalQuestionsAttempted: 1,
          totalCorrect: isCorrect ? 1 : 0,
          accuracyPercentage: isCorrect ? 100 : 0,
          masteryStatus: isCorrect ? 'mastered' : 'needs_focus',
          lastPracticedAt: new Date().toISOString(),
        });
      }
    });
    storage.setTopicProgress(topicProgress);

    return {
      success: true,
      data: attempt,
      message: 'Quiz submitted and evaluated',
    };
  },

  async getAttempts(): Promise<ApiResponse<QuizAttempt[]>> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return { success: true, data: storage.getAttempts() };
  },
};
