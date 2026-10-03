import { db } from './index.ts';
import { studyPlans } from './schema.ts';
import { eq, and, desc } from 'drizzle-orm';

export async function getStudyPlans(userId: string, subjectId?: number) {
  try {
    const conditions = [eq(studyPlans.userId, userId)];
    if (subjectId) conditions.push(eq(studyPlans.subjectId, subjectId));

    return await db
      .select()
      .from(studyPlans)
      .where(and(...conditions))
      .orderBy(desc(studyPlans.createdAt));
  } catch (error) {
    console.error('Error fetching study plans:', error);
    throw new Error('Failed to fetch study plans', { cause: error });
  }
}

export async function createStudyPlan(
  userId: string,
  subjectId: number,
  title: string,
  targetDate: string | null,
  dailyGoals: Array<{ day: number; topic: string; tasks: string[]; done: boolean }>,
) {
  try {
    const [created] = await db
      .insert(studyPlans)
      .values({
        userId,
        subjectId,
        title,
        targetDate,
        dailyGoals,
        isActive: true,
      })
      .returning();

    return created;
  } catch (error) {
    console.error('Error creating study plan:', error);
    throw new Error('Failed to create study plan', { cause: error });
  }
}

export async function toggleStudyPlanDay(
  userId: string,
  planId: number,
  dayNumber: number,
) {
  try {
    const [plan] = await db
      .select()
      .from(studyPlans)
      .where(and(eq(studyPlans.id, planId), eq(studyPlans.userId, userId)))
      .limit(1);

    if (!plan) throw new Error('Study plan not found');

    const updatedGoals = plan.dailyGoals.map((g) => {
      if (g.day === dayNumber) {
        return { ...g, done: !g.done };
      }
      return g;
    });

    const [updated] = await db
      .update(studyPlans)
      .set({ dailyGoals: updatedGoals })
      .where(and(eq(studyPlans.id, planId), eq(studyPlans.userId, userId)))
      .returning();

    return updated;
  } catch (error) {
    console.error('Error updating study plan day:', error);
    throw new Error('Failed to update study plan progress', { cause: error });
  }
}

export async function deleteStudyPlan(userId: string, planId: number) {
  try {
    await db
      .delete(studyPlans)
      .where(and(eq(studyPlans.id, planId), eq(studyPlans.userId, userId)));
    return true;
  } catch (error) {
    console.error('Error deleting study plan:', error);
    throw new Error('Failed to delete study plan', { cause: error });
  }
}
