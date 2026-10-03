import { db } from './index.ts';
import { topicProgress, studySessions, quizzes, quizAttempts, subjects, studyMaterials } from './schema.ts';
import { eq, and, desc, sql, asc } from 'drizzle-orm';

export async function getTopicProgressBySubject(userId: string, subjectId?: number) {
  try {
    const conditions = [eq(topicProgress.userId, userId)];
    if (subjectId) conditions.push(eq(topicProgress.subjectId, subjectId));

    return await db
      .select({
        id: topicProgress.id,
        subjectId: topicProgress.subjectId,
        topicName: topicProgress.topicName,
        totalQuestionsAttempted: topicProgress.totalQuestionsAttempted,
        totalCorrect: topicProgress.totalCorrect,
        masteryStatus: topicProgress.masteryStatus,
        lastPracticedAt: topicProgress.lastPracticedAt,
        accuracy: sql<number>`CASE WHEN ${topicProgress.totalQuestionsAttempted} > 0 THEN ROUND((${topicProgress.totalCorrect}::numeric / ${topicProgress.totalQuestionsAttempted}::numeric) * 100, 1) ELSE 0 END`,
      })
      .from(topicProgress)
      .where(and(...conditions))
      .orderBy(asc(sql`CASE WHEN ${topicProgress.totalQuestionsAttempted} > 0 THEN (${topicProgress.totalCorrect}::numeric / ${topicProgress.totalQuestionsAttempted}::numeric) ELSE 0 END`));
  } catch (error) {
    console.error('Error in getTopicProgressBySubject:', error);
    throw new Error('Failed to fetch topic mastery progress', { cause: error });
  }
}

export async function getWeakTopics(userId: string, subjectId?: number) {
  try {
    const all = await getTopicProgressBySubject(userId, subjectId);
    // Weak topics are topics with accuracy < 70% or masteryStatus === 'needs_focus'
    return all.filter((t) => Number(t.accuracy) < 70 || t.masteryStatus === 'needs_focus');
  } catch (error) {
    console.error('Error fetching weak topics:', error);
    throw new Error('Failed to identify weak topics', { cause: error });
  }
}

export async function recordStudySession(
  userId: string,
  data: {
    subjectId?: number;
    activityType: string;
    durationMinutes: number;
    notes?: string;
  },
) {
  try {
    const [session] = await db
      .insert(studySessions)
      .values({
        userId,
        subjectId: data.subjectId || null,
        activityType: data.activityType,
        durationMinutes: data.durationMinutes,
        notes: data.notes || null,
      })
      .returning();

    return session;
  } catch (error) {
    console.error('Error recording study session:', error);
    throw new Error('Failed to log study session', { cause: error });
  }
}

export async function getStudySessions(userId: string) {
  try {
    return await db
      .select()
      .from(studySessions)
      .where(eq(studySessions.userId, userId))
      .orderBy(desc(studySessions.startedAt))
      .limit(30);
  } catch (error) {
    console.error('Error in getStudySessions:', error);
    throw new Error('Failed to fetch study sessions', { cause: error });
  }
}

export async function getDashboardOverview(userId: string) {
  try {
    const [subjectCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(subjects)
      .where(eq(subjects.userId, userId));

    const [materialsCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(studyMaterials)
      .where(eq(studyMaterials.userId, userId));

    const [quizzesCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(quizzes)
      .where(eq(quizzes.userId, userId));

    const [attemptsCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(quizAttempts)
      .where(eq(quizAttempts.userId, userId));

    const [studyMinutesTotal] = await db
      .select({ total: sql<number>`coalesce(sum(${studySessions.durationMinutes}), 0)::int` })
      .from(studySessions)
      .where(eq(studySessions.userId, userId));

    const attempts = await db
      .select()
      .from(quizAttempts)
      .where(eq(quizAttempts.userId, userId));

    const avgScore =
      attempts.length > 0
        ? Math.round(attempts.reduce((sum, a) => sum + Number(a.score), 0) / attempts.length)
        : 0;

    const weakTopics = await getWeakTopics(userId);

    return {
      totalSubjects: subjectCount?.count || 0,
      totalMaterials: materialsCount?.count || 0,
      totalQuizzes: quizzesCount?.count || 0,
      totalAttempts: attemptsCount?.count || 0,
      totalStudyMinutes: studyMinutesTotal?.total || 0,
      averageQuizScore: avgScore,
      weakTopicsCount: weakTopics.length,
      weakTopicsList: weakTopics.slice(0, 5),
    };
  } catch (error) {
    console.error('Error computing dashboard analytics:', error);
    throw new Error('Failed to load dashboard overview', { cause: error });
  }
}
