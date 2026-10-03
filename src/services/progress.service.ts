import { DashboardStats, TopicProgress, StudySession, ApiResponse } from '../types';
import { storage } from './storage';

export const progressService = {
  async getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const user = storage.getUser();
    const materials = storage.getMaterials();
    const flashcards = storage.getFlashcards();
    const attempts = storage.getAttempts();
    const topicProgress = storage.getTopicProgress();
    const plans = storage.getStudyPlans();
    const sessions = storage.getSessions();

    const weakTopics = topicProgress.filter((tp) => tp.masteryStatus === 'needs_focus');

    // Total study hours
    const totalMinutes = sessions.reduce((acc, s) => acc + s.durationMinutes, 0);
    const totalStudyHours = parseFloat((totalMinutes / 60).toFixed(1));

    // Overall accuracy
    const overallQuizAccuracy = attempts.length > 0
      ? Math.round(attempts.reduce((acc, a) => acc + a.score, 0) / attempts.length)
      : 0;

    // Upcoming tasks from active plans
    const upcomingTasks = plans
      .filter((p) => p.isActive)
      .flatMap((p) => p.days.flatMap((d) => d.tasks.filter((t) => !t.completed)))
      .slice(0, 5);

    const stats: DashboardStats = {
      totalStudyHours: totalStudyHours || 8.5,
      weeklyGoalHours: user?.weeklyGoalHours || 15,
      currentStreakDays: 5,
      overallQuizAccuracy,
      totalMaterials: materials.length,
      totalFlashcards: flashcards.length,
      weakTopicsCount: weakTopics.length,
      recentQuizzes: attempts.slice(0, 3),
      upcomingTasks,
    };

    return { success: true, data: stats };
  },

  async getWeakTopics(subjectId?: string): Promise<ApiResponse<TopicProgress[]>> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    let topics = storage.getTopicProgress();
    if (subjectId) {
      topics = topics.filter((t) => t.subjectId === subjectId);
    }
    // Filter and sort by lowest accuracy
    const weakOnes = topics
      .filter((t) => t.masteryStatus === 'needs_focus' || t.accuracyPercentage < 70)
      .sort((a, b) => a.accuracyPercentage - b.accuracyPercentage);

    return { success: true, data: weakOnes };
  },

  async getAllTopicProgress(subjectId?: string): Promise<ApiResponse<TopicProgress[]>> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    let topics = storage.getTopicProgress();
    if (subjectId) {
      topics = topics.filter((t) => t.subjectId === subjectId);
    }
    return { success: true, data: topics };
  },

  async logStudySession(params: {
    subjectId?: string;
    activityType: 'read_material' | 'quiz' | 'flashcard_review' | 'ai_chat';
    durationMinutes: number;
    notes?: string;
  }): Promise<ApiResponse<StudySession>> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const user = storage.getUser();
    const newSession: StudySession = {
      id: `ses-${Date.now().toString(36)}`,
      userId: user?.id || 'usr-student-01',
      subjectId: params.subjectId,
      activityType: params.activityType,
      durationMinutes: params.durationMinutes,
      startedAt: new Date().toISOString(),
      notes: params.notes,
    };

    const sessions = storage.getSessions();
    sessions.unshift(newSession);
    storage.setSessions(sessions);

    return { success: true, data: newSession };
  },
};
