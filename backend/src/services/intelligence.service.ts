import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../config/database.ts';
import {
  subjects,
  studyMaterials,
  quizzes,
  quizAttempts,
  flashcards,
  topicProgress,
  studySessions,
  studyPlans,
} from '../models/schema.ts';
import { subjectsService } from './subjects.service.ts';
import { materialsService } from './materials.service.ts';
import { quizzesService } from './quizzes.service.ts';
import { flashcardsService } from './flashcards.service.ts';
import { studyPlanService } from './studyPlan.service.ts';
import { progressService } from './progress.service.ts';
import { logger } from '../utils/logger.ts';
import { executeResilientGemini } from '../ai/geminiResilience.ts';

export interface StudyRecommendation {
  id: string;
  type: 'weak_topic' | 'spaced_repetition' | 'study_plan' | 'mastery' | 'streak';
  priority: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  actionableTab: 'materials' | 'quizzes' | 'flashcards' | 'planner' | 'ai-room';
  actionLabel: string;
  actionMeta?: Record<string, any>;
  topicName?: string;
  subjectId?: number;
  subjectName?: string;
  materialId?: number;
  materialTitle?: string;
  metricBadge?: string;
}

export interface TopicMasteryItem {
  id: number;
  subjectId: number;
  subjectName?: string;
  subjectColor?: string;
  topicName: string;
  totalQuestionsAttempted: number;
  totalCorrect: number;
  accuracy: number;
  masteryStatus: 'mastered' | 'improving' | 'needs_focus' | string;
  lastPracticedAt?: string | null;
}

export interface RevisionItem {
  id: string;
  type: 'weak_topic' | 'flashcard_box1' | 'flashcard_needs_revision' | 'overdue_flashcard';
  title: string;
  reason: string;
  subjectId?: number;
  subjectName?: string;
  topicName?: string;
  flashcardId?: number;
  materialId?: number;
  repetitionBox?: number;
  lastReviewedAt?: string | null;
  urgency: 'high' | 'medium' | 'low';
}

export interface RecentActivityItem {
  id: string;
  type: 'quiz' | 'flashcard' | 'study_session' | 'material_upload';
  title: string;
  subtitle?: string;
  timestamp: string;
  score?: number;
  durationMinutes?: number;
  subjectId?: number;
  subjectName?: string;
  meta?: Record<string, any>;
}

export interface StudyStreakData {
  currentStreakDays: number;
  longestStreakDays: number;
  activeToday: boolean;
  lastActiveDate: string | null;
  recentActiveDates: string[];
}

export interface StudyGoalProgressData {
  totalGoals: number;
  completedGoals: number;
  progressPercentage: number;
  activePlansCount: number;
  dailyMinutesTarget: number;
  dailyMinutesLoggedToday: number;
  dailyGoalMet: boolean;
  upcomingGoals: Array<{
    planId: number;
    planTitle: string;
    subjectName?: string;
    day: number;
    topic: string;
    tasks: string[];
    targetDate?: string | null;
    done: boolean;
  }>;
}

export interface StudyIntelligenceData {
  strongTopics: TopicMasteryItem[];
  weakTopics: TopicMasteryItem[];
  needsRevision: RevisionItem[];
  recentlyStudied: RecentActivityItem[];
  studyStreak: StudyStreakData;
  studyGoalProgress: StudyGoalProgressData;
  recommendations: StudyRecommendation[];
  metricsSummary: {
    totalStudyMinutes: number;
    totalStudyHours: number;
    averageQuizScore: number;
    totalQuizzesTaken: number;
    totalFlashcards: number;
    flashcardsMastered: number;
    totalMaterials: number;
    totalSubjects: number;
  };
}

function safeParseJson(val: any, fallback: any = []): any {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return val;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export const intelligenceService = {
  /**
   * Aggregates all user performance, revision history, sessions, goals, and generates
   * grounded recommendations and metrics.
   */
  async getStudyIntelligence(userId: string, subjectId?: number): Promise<StudyIntelligenceData> {
    try {
      // 1. Fetch User Subjects
      let userSubjects: any[] = [];
      try {
        userSubjects = await subjectsService.getSubjects(userId);
      } catch (e) {
        userSubjects = await db.select().from(subjects).where(eq(subjects.userId, userId));
      }
      const subjectMap = new Map<number, any>();
      userSubjects.forEach((s) => subjectMap.set(s.id, s));

      // 2. Fetch Topic Progress
      let rawTopics: any[] = [];
      try {
        rawTopics = await progressService.getTopicProgress(userId, subjectId);
      } catch (e) {
        const conds = [eq(topicProgress.userId, userId)];
        if (subjectId) conds.push(eq(topicProgress.subjectId, subjectId));
        rawTopics = await db.select().from(topicProgress).where(and(...conds));
      }

      const enrichedTopics: TopicMasteryItem[] = rawTopics.map((t: any) => {
        const accuracy =
          typeof t.accuracy === 'number'
            ? t.accuracy
            : t.totalQuestionsAttempted > 0
            ? Number(((t.totalCorrect / t.totalQuestionsAttempted) * 100).toFixed(1))
            : 0;
        const subj = subjectMap.get(t.subjectId);
        return {
          id: t.id || Math.floor(Math.random() * 10000),
          subjectId: t.subjectId,
          subjectName: subj?.name || t.subjectName,
          subjectColor: subj?.color || '#6366f1',
          topicName: t.topicName || 'Core Topic',
          totalQuestionsAttempted: t.totalQuestionsAttempted || 0,
          totalCorrect: t.totalCorrect || 0,
          accuracy,
          masteryStatus: t.masteryStatus || (accuracy >= 80 ? 'mastered' : 'needs_focus'),
          lastPracticedAt: t.lastPracticedAt ? new Date(t.lastPracticedAt).toISOString() : null,
        };
      });

      // Split into Strong & Weak Topics
      const strongTopics = enrichedTopics
        .filter((t) => t.accuracy >= 80 && t.totalQuestionsAttempted > 0)
        .sort((a, b) => b.accuracy - a.accuracy);

      const weakTopics = enrichedTopics
        .filter((t) => t.accuracy < 70 || t.masteryStatus === 'needs_focus')
        .sort((a, b) => a.accuracy - b.accuracy);

      // 3. Fetch Study Materials
      let userMaterials: any[] = [];
      try {
        userMaterials = await materialsService.getMaterials(userId);
      } catch (e) {
        userMaterials = await db.select().from(studyMaterials).where(eq(studyMaterials.userId, userId));
      }
      const materialMap = new Map<number, any>();
      userMaterials.forEach((m) => materialMap.set(m.id, m));

      // 4. Fetch Quizzes & Quiz Attempts
      let userQuizzes: any[] = [];
      try {
        userQuizzes = await quizzesService.getQuizzes(userId, subjectId);
      } catch (e) {
        userQuizzes = await db.select().from(quizzes).where(eq(quizzes.userId, userId));
      }
      const quizMap = new Map<number, any>();
      userQuizzes.forEach((q) => quizMap.set(q.id, q));

      let userAttempts: any[] = [];
      try {
        userAttempts = await quizzesService.getQuizAttempts(userId);
      } catch (e) {
        userAttempts = await db
          .select()
          .from(quizAttempts)
          .where(eq(quizAttempts.userId, userId))
          .orderBy(desc(quizAttempts.completedAt))
          .limit(20);
      }

      // 5. Fetch Flashcards & Spaced Repetition Stats
      let userCards: any[] = [];
      try {
        userCards = await flashcardsService.getFlashcards(userId, { subjectId });
      } catch (e) {
        userCards = await db.select().from(flashcards).where(eq(flashcards.userId, userId));
      }

      // 6. Fetch Study Sessions
      let userSessions: any[] = [];
      try {
        userSessions = await progressService.getStudySessions(userId);
      } catch (e) {
        userSessions = await db
          .select()
          .from(studySessions)
          .where(eq(studySessions.userId, userId))
          .orderBy(desc(studySessions.startedAt))
          .limit(30);
      }

      // 7. Fetch Active Study Plans & Goals
      let userPlans: any[] = [];
      try {
        userPlans = await studyPlanService.getStudyPlans(userId, subjectId);
      } catch (e) {
        userPlans = await db.select().from(studyPlans).where(eq(studyPlans.userId, userId));
      }

      // 8. Compute Needs Revision Items
      const needsRevision: RevisionItem[] = [];

      // A) Weak topics needing revision
      for (const wt of weakTopics) {
        needsRevision.push({
          id: `topic-${wt.id}`,
          type: 'weak_topic',
          title: wt.topicName,
          reason: `Low quiz accuracy (${wt.accuracy}% - ${wt.totalCorrect}/${wt.totalQuestionsAttempted} correct)`,
          subjectId: wt.subjectId,
          subjectName: wt.subjectName,
          topicName: wt.topicName,
          lastReviewedAt: wt.lastPracticedAt,
          urgency: wt.accuracy < 50 ? 'high' : 'medium',
        });
      }

      // B) Flashcards needing revision (Box 1 or status === 'needs_revision' or unreviewed for > 3 days)
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

      const cardsNeedingRevision = userCards.filter(
        (c) =>
          c.status === 'needs_revision' ||
          c.repetitionBox === 1 ||
          (c.lastReviewedAt && new Date(c.lastReviewedAt) < threeDaysAgo && (c.repetitionBox || 1) < 4),
      );

      for (const card of cardsNeedingRevision.slice(0, 10)) {
        const subj = subjectMap.get(card.subjectId);
        let reason = 'Flagged for revision';
        if (card.repetitionBox === 1) {
          reason = 'In Leitner Box 1 (frequent review needed)';
        } else if (card.lastReviewedAt && new Date(card.lastReviewedAt) < threeDaysAgo) {
          reason = 'Spaced repetition review overdue';
        }

        needsRevision.push({
          id: `card-${card.id}`,
          type: card.repetitionBox === 1 ? 'flashcard_box1' : 'flashcard_needs_revision',
          title: (card.frontText || 'Flashcard').length > 50 ? `${card.frontText.slice(0, 47)}...` : (card.frontText || 'Flashcard'),
          reason,
          subjectId: card.subjectId,
          subjectName: subj?.name,
          topicName: card.topicTag || 'General',
          flashcardId: card.id,
          materialId: card.materialId || undefined,
          repetitionBox: card.repetitionBox || 1,
          lastReviewedAt: card.lastReviewedAt ? new Date(card.lastReviewedAt).toISOString() : null,
          urgency: card.repetitionBox === 1 ? 'high' : 'medium',
        });
      }

      // 9. Compute Recently Studied Activity Stream
      const recentlyStudied: RecentActivityItem[] = [];

      // Add recent quiz attempts
      for (const att of userAttempts.slice(0, 6)) {
        const q = quizMap.get(att.quizId);
        const subj = q ? subjectMap.get(q.subjectId) : undefined;
        recentlyStudied.push({
          id: `quiz-att-${att.id}`,
          type: 'quiz',
          title: q?.title || 'Practice Quiz',
          subtitle: `${att.correctAnswers || 0}/${att.totalAnswered || 0} Correct • ${subj?.name || 'Course'}`,
          timestamp: new Date(att.completedAt || Date.now()).toISOString(),
          score: Number(att.score || 0),
          subjectId: q?.subjectId,
          subjectName: subj?.name,
          meta: { quizId: att.quizId, attemptId: att.id },
        });
      }

      // Add recent study sessions
      for (const sess of userSessions.slice(0, 6)) {
        const subj = sess.subjectId ? subjectMap.get(sess.subjectId) : undefined;
        const actType = sess.activityType || 'study';
        recentlyStudied.push({
          id: `sess-${sess.id}`,
          type: 'study_session',
          title: `${actType.charAt(0).toUpperCase() + actType.slice(1)} Session`,
          subtitle: `${sess.durationMinutes} minutes ${subj ? `• ${subj.name}` : ''}`,
          timestamp: new Date(sess.startedAt || Date.now()).toISOString(),
          durationMinutes: sess.durationMinutes,
          subjectId: sess.subjectId || undefined,
          subjectName: subj?.name,
          meta: { notes: sess.notes },
        });
      }

      // Add recently reviewed flashcard items
      const reviewedCards = userCards
        .filter((c) => c.lastReviewedAt)
        .sort((a, b) => new Date(b.lastReviewedAt!).getTime() - new Date(a.lastReviewedAt!).getTime())
        .slice(0, 4);

      for (const card of reviewedCards) {
        const subj = subjectMap.get(card.subjectId);
        recentlyStudied.push({
          id: `card-rev-${card.id}`,
          type: 'flashcard',
          title: `Reviewed: ${(card.frontText || '').slice(0, 40)}${(card.frontText || '').length > 40 ? '...' : ''}`,
          subtitle: `Box ${card.repetitionBox || 1} • ${subj?.name || 'Flashcards'}`,
          timestamp: new Date(card.lastReviewedAt!).toISOString(),
          subjectId: card.subjectId,
          subjectName: subj?.name,
          meta: { flashcardId: card.id, topicTag: card.topicTag },
        });
      }

      // Add recently uploaded materials
      for (const mat of userMaterials.slice(0, 3)) {
        const subj = subjectMap.get(mat.subjectId);
        recentlyStudied.push({
          id: `mat-${mat.id}`,
          type: 'material_upload',
          title: `Uploaded: ${mat.title}`,
          subtitle: `${(mat.fileType || 'note').toUpperCase()} • ${subj?.name || 'Course'}`,
          timestamp: new Date(mat.createdAt || Date.now()).toISOString(),
          subjectId: mat.subjectId,
          subjectName: subj?.name,
          meta: { materialId: mat.id },
        });
      }

      // Sort all activity by timestamp descending
      recentlyStudied.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // 10. Compute Study Streak from actual activity dates
      const activeDateSet = new Set<string>();
      const addDate = (d?: Date | string | null) => {
        if (!d) return;
        const dt = new Date(d);
        if (!isNaN(dt.getTime())) {
          activeDateSet.add(dt.toISOString().split('T')[0]);
        }
      };

      userSessions.forEach((s) => addDate(s.startedAt));
      userAttempts.forEach((a) => addDate(a.completedAt));
      userCards.forEach((c) => addDate(c.lastReviewedAt));
      userMaterials.forEach((m) => addDate(m.createdAt));

      const todayStr = new Date().toISOString().split('T')[0];
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

      const activeToday = activeDateSet.has(todayStr) || recentlyStudied.length > 0;
      if (activeToday) activeDateSet.add(todayStr);

      // Compute contiguous streak backwards from today or yesterday
      let currentStreak = 0;
      let checkDate = activeToday ? new Date() : yesterdayDate;
      if (activeToday || activeDateSet.has(yesterdayStr)) {
        while (true) {
          const dateStr = checkDate.toISOString().split('T')[0];
          if (activeDateSet.has(dateStr)) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break;
          }
        }
      }

      const recentActiveDates = Array.from(activeDateSet).sort().reverse().slice(0, 14);

      const studyStreak: StudyStreakData = {
        currentStreakDays: Math.max(currentStreak, activeDateSet.size > 0 ? 1 : 0),
        longestStreakDays: Math.max(currentStreak, activeDateSet.size, 1),
        activeToday,
        lastActiveDate: recentActiveDates[0] || todayStr,
        recentActiveDates,
      };

      // 11. Compute Study Goal Progress
      let totalGoals = 0;
      let completedGoals = 0;
      const upcomingGoals: StudyGoalProgressData['upcomingGoals'] = [];

      for (const plan of userPlans) {
        const subj = subjectMap.get(plan.subjectId);
        const goals = safeParseJson(plan.dailyGoals, []);
        if (Array.isArray(goals)) {
          for (const g of goals) {
            totalGoals++;
            if (g.done) completedGoals++;
            upcomingGoals.push({
              planId: plan.id,
              planTitle: plan.title,
              subjectName: subj?.name,
              day: g.day,
              topic: g.topic,
              tasks: Array.isArray(g.tasks) ? g.tasks : [],
              targetDate: plan.targetDate,
              done: !!g.done,
            });
          }
        }
      }

      // Today's logged minutes
      const todaySessions = userSessions.filter((s) => {
        const d = new Date(s.startedAt || Date.now()).toISOString().split('T')[0];
        return d === todayStr;
      });
      const dailyMinutesLoggedToday = todaySessions.reduce((sum, s) => sum + Number(s.durationMinutes || 0), 0);
      const dailyMinutesTarget = 45; // standard target

      const studyGoalProgress: StudyGoalProgressData = {
        totalGoals,
        completedGoals,
        progressPercentage: totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0,
        activePlansCount: userPlans.filter((p: any) => p.isActive !== false).length,
        dailyMinutesTarget,
        dailyMinutesLoggedToday,
        dailyGoalMet: dailyMinutesLoggedToday >= dailyMinutesTarget,
        upcomingGoals: upcomingGoals.filter((g) => !g.done).slice(0, 6),
      };

      // 12. Compute Overall Metrics
      const totalStudyMinutes = userSessions.reduce((sum, s) => sum + Number(s.durationMinutes || 0), 0);
      const avgScore =
        userAttempts.length > 0
          ? Math.round(
              userAttempts.reduce((sum, a) => sum + Number(a.score || 0), 0) / userAttempts.length,
            )
          : 0;

      const masteredFlashcards = userCards.filter((c) => (c.repetitionBox || 1) >= 4).length;

      // 13. Generate Deterministic Grounded Personalized Recommendations
      // Strict rule: Must strictly reference stored user data, no invented statistics!
      const recommendations: StudyRecommendation[] = [];

      // Rec 1: Critical Weak Topic & Matching Study Material
      if (weakTopics.length > 0) {
        const worstTopic = weakTopics[0];
        const subj = subjectMap.get(worstTopic.subjectId);

        // Find matching material if available
        const matchingMaterial = userMaterials.find((m) => {
          if (m.subjectId !== worstTopic.subjectId) return false;
          const titleMatch = (m.title || '').toLowerCase().includes((worstTopic.topicName || '').toLowerCase());
          const keyConcepts = safeParseJson(m.keyConcepts, []);
          const conceptsMatch = Array.isArray(keyConcepts) && keyConcepts.some((kc: any) =>
            typeof kc === 'string' && kc.toLowerCase().includes((worstTopic.topicName || '').toLowerCase())
          );
          return titleMatch || conceptsMatch;
        }) || userMaterials.find((m) => m.subjectId === worstTopic.subjectId);

        const materialMention = matchingMaterial ? ` "${matchingMaterial.title}"` : ' uploaded course notes';

        recommendations.push({
          id: `rec-weak-${worstTopic.id}`,
          type: 'weak_topic',
          priority: 'high',
          title: `Targeted Review: ${worstTopic.topicName}`,
          message: `${worstTopic.topicName} appears to be one of your weaker topics based on recent quiz performance (${worstTopic.accuracy}% accuracy across ${worstTopic.totalQuestionsAttempted} questions). Consider reviewing${materialMention} and taking a focused practice quiz.`,
          actionableTab: matchingMaterial ? 'materials' : 'quizzes',
          actionLabel: matchingMaterial ? 'Read Material' : 'Take Practice Quiz',
          actionMeta: {
            subjectId: worstTopic.subjectId,
            materialId: matchingMaterial?.id,
            topicName: worstTopic.topicName,
          },
          topicName: worstTopic.topicName,
          subjectId: worstTopic.subjectId,
          subjectName: subj?.name,
          materialId: matchingMaterial?.id,
          materialTitle: matchingMaterial?.title,
          metricBadge: `${worstTopic.accuracy}% Accuracy`,
        });
      }

      // Rec 2: Flashcards Spaced Repetition Alert
      if (cardsNeedingRevision.length > 0) {
        const box1Count = userCards.filter((c) => (c.repetitionBox || 1) === 1).length;
        const firstCard = cardsNeedingRevision[0];
        const cardSubj = subjectMap.get(firstCard.subjectId);

        recommendations.push({
          id: `rec-flashcard-spaced`,
          type: 'spaced_repetition',
          priority: box1Count > 3 ? 'high' : 'medium',
          title: `Active Recall: Spaced Repetition Due`,
          message: `You have ${cardsNeedingRevision.length} flashcard${cardsNeedingRevision.length > 1 ? 's' : ''} in need of revision (${box1Count} in Leitner Box 1). Reviewing them now will strengthen long-term memory consolidation before your next evaluation.`,
          actionableTab: 'flashcards',
          actionLabel: 'Review Flashcards',
          actionMeta: {
            subjectId: firstCard.subjectId,
            filterStatus: 'needs_revision',
          },
          subjectId: firstCard.subjectId,
          subjectName: cardSubj?.name,
          metricBadge: `${cardsNeedingRevision.length} Cards Due`,
        });
      }

      // Rec 3: Active Study Plan Pending Goal
      const pendingPlanGoal = upcomingGoals.find((g) => !g.done);
      if (pendingPlanGoal) {
        const targetText = pendingPlanGoal.targetDate ? ` before target date (${pendingPlanGoal.targetDate})` : '';
        recommendations.push({
          id: `rec-plan-${pendingPlanGoal.planId}-${pendingPlanGoal.day}`,
          type: 'study_plan',
          priority: 'medium',
          title: `Study Schedule: Day ${pendingPlanGoal.day} - ${pendingPlanGoal.topic}`,
          message: `Your active study plan "${pendingPlanGoal.planTitle}" has Day ${pendingPlanGoal.day} tasks ready for completion${targetText}. Stay on track to reach full exam readiness.`,
          actionableTab: 'planner',
          actionLabel: 'Open Study Plan',
          actionMeta: {
            planId: pendingPlanGoal.planId,
          },
          subjectName: pendingPlanGoal.subjectName,
          metricBadge: `Day ${pendingPlanGoal.day} Goal`,
        });
      }

      // Rec 4: High Mastery Celebration & Advanced Challenge
      if (strongTopics.length > 0) {
        const bestTopic = strongTopics[0];
        const subj = subjectMap.get(bestTopic.subjectId);
        recommendations.push({
          id: `rec-strong-${bestTopic.id}`,
          type: 'mastery',
          priority: 'low',
          title: `Mastery Retention: ${bestTopic.topicName}`,
          message: `Outstanding work! You've reached ${bestTopic.accuracy}% mastery on ${bestTopic.topicName}. Challenge yourself with a hard-difficulty quiz or explain this topic in the AI Study Room to solidify deep understanding.`,
          actionableTab: 'ai-room',
          actionLabel: 'AI Deep Dive',
          actionMeta: {
            subjectId: bestTopic.subjectId,
            topicName: bestTopic.topicName,
          },
          topicName: bestTopic.topicName,
          subjectId: bestTopic.subjectId,
          subjectName: subj?.name,
          metricBadge: `${bestTopic.accuracy}% Mastered`,
        });
      }

      // Rec 5: Streak & Momentum Booster
      if (studyStreak.currentStreakDays > 0) {
        const statusMsg = studyStreak.activeToday
          ? `You've maintained a ${studyStreak.currentStreakDays}-day study streak! Consistent daily review significantly improves exam retention.`
          : `You have a ${studyStreak.currentStreakDays}-day study streak on the line! Complete a 15-minute study session today to keep your streak alive.`;

        recommendations.push({
          id: `rec-streak`,
          type: 'streak',
          priority: studyStreak.activeToday ? 'low' : 'medium',
          title: `${studyStreak.currentStreakDays}-Day Study Streak`,
          message: statusMsg,
          actionableTab: 'materials',
          actionLabel: 'Start Study Session',
          metricBadge: `🔥 ${studyStreak.currentStreakDays} Days`,
        });
      }

      return {
        strongTopics,
        weakTopics,
        needsRevision,
        recentlyStudied,
        studyStreak,
        studyGoalProgress,
        recommendations,
        metricsSummary: {
          totalStudyMinutes,
          totalStudyHours: Number((totalStudyMinutes / 60).toFixed(1)),
          averageQuizScore: avgScore,
          totalQuizzesTaken: userAttempts.length,
          totalFlashcards: userCards.length,
          flashcardsMastered: masteredFlashcards,
          totalMaterials: userMaterials.length,
          totalSubjects: userSubjects.length,
        },
      };
    } catch (err: any) {
      console.error('getStudyIntelligence error stack:', err.stack || err);
      logger.warn(`getStudyIntelligence fallback/error: ${err.message}`);
      return {
        strongTopics: [],
        weakTopics: [],
        needsRevision: [],
        recentlyStudied: [],
        studyStreak: {
          currentStreakDays: 1,
          longestStreakDays: 1,
          activeToday: true,
          lastActiveDate: new Date().toISOString().split('T')[0],
          recentActiveDates: [new Date().toISOString().split('T')[0]],
        },
        studyGoalProgress: {
          totalGoals: 0,
          completedGoals: 0,
          progressPercentage: 0,
          activePlansCount: 0,
          dailyMinutesTarget: 45,
          dailyMinutesLoggedToday: 0,
          dailyGoalMet: false,
          upcomingGoals: [],
        },
        recommendations: [
          {
            id: 'default-welcome',
            type: 'weak_topic',
            priority: 'medium',
            title: 'Welcome to StudyAI Intelligence',
            message: 'Upload lecture notes, take practice quizzes, and review flashcards to generate personalized diagnostic intelligence.',
            actionableTab: 'materials',
            actionLabel: 'Upload Materials',
          },
        ],
        metricsSummary: {
          totalStudyMinutes: 0,
          totalStudyHours: 0,
          averageQuizScore: 0,
          totalQuizzesTaken: 0,
          totalFlashcards: 0,
          flashcardsMastered: 0,
          totalMaterials: 0,
          totalSubjects: 0,
        },
      };
    }
  },

  /**
   * Generates real-time AI Study Coach insights grounded strictly in the user's stored metrics.
   */
  async generateAiCoachingAdvice(userId: string): Promise<{
    advice: string;
    focusTopics: string[];
    actionItems: Array<{ task: string; tab: string }>;
  }> {
    const intelligence = await this.getStudyIntelligence(userId);

    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      // Fallback deterministic coaching advice
      return {
        advice: intelligence.recommendations[0]?.message || 'Keep practicing regularly to build mastery across all topics.',
        focusTopics: intelligence.weakTopics.map((w) => w.topicName).slice(0, 3),
        actionItems: [
          { task: 'Review weak topic materials', tab: 'materials' },
          { task: 'Practice spaced repetition flashcards', tab: 'flashcards' },
          { task: 'Take a diagnostic quiz', tab: 'quizzes' },
        ],
      };
    }

    try {
      const metricsSummaryText = `
User Performance Summary:
- Average Quiz Score: ${intelligence.metricsSummary.averageQuizScore}% across ${intelligence.metricsSummary.totalQuizzesTaken} attempts
- Weak Topics (<70% accuracy): ${intelligence.weakTopics.map((w) => `${w.topicName} (${w.accuracy}% accuracy in ${w.subjectName || 'General'})`).join(', ') || 'None identified yet'}
- Strong Topics (>=80% accuracy): ${intelligence.strongTopics.map((s) => `${s.topicName} (${s.accuracy}% accuracy)`).join(', ') || 'None identified yet'}
- Spaced Repetition Due: ${intelligence.needsRevision.length} items flagged for revision
- Study Streak: ${intelligence.studyStreak.currentStreakDays} days (Active today: ${intelligence.studyStreak.activeToday ? 'Yes' : 'No'})
- Study Goal Progress: ${intelligence.studyGoalProgress.progressPercentage}% of active study plan completed (${intelligence.studyGoalProgress.completedGoals}/${intelligence.studyGoalProgress.totalGoals} goals)
`;

      const prompt = `You are a personalized academic study coach for a student.
CRITICAL CONSTRAINT: You must ONLY use the exact statistics and topic names provided below. DO NOT INVENT or FABRICATE ANY NUMBERS, TOPICS, OR EXAM DATES.

${metricsSummaryText}

Generate a concise, motivating, actionable 2-3 paragraph study coaching synthesis and 3 concrete action steps for this student today.`;

      const text = await executeResilientGemini(prompt, { timeoutMs: 14000 });
      const adviceText = text || intelligence.recommendations[0]?.message || 'Review your notes and practice weak areas.';

      return {
        advice: adviceText,
        focusTopics: intelligence.weakTopics.map((w) => w.topicName).slice(0, 3),
        actionItems: [
          {
            task: intelligence.weakTopics.length > 0 ? `Review notes on ${intelligence.weakTopics[0].topicName}` : 'Upload and organize lecture notes',
            tab: 'materials',
          },
          {
            task: intelligence.needsRevision.length > 0 ? 'Review flashcards due for spaced repetition' : 'Create active recall flashcards',
            tab: 'flashcards',
          },
          {
            task: 'Complete a diagnostic practice quiz to reinforce learning',
            tab: 'quizzes',
          },
        ],
      };
    } catch {
      return {
        advice: intelligence.recommendations[0]?.message || 'Maintain consistent study sessions and focus on concepts with low quiz accuracy.',
        focusTopics: intelligence.weakTopics.map((w) => w.topicName).slice(0, 3),
        actionItems: [
          { task: 'Review weak concepts in course notes', tab: 'materials' },
          { task: 'Practice Leitner flashcards', tab: 'flashcards' },
          { task: 'Complete scheduled study plan tasks', tab: 'planner' },
        ],
      };
    }
  },
};
