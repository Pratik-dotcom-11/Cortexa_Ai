import { eq, and, desc } from 'drizzle-orm';
import { db, isDbActive } from '../config/database.ts';
import { studyPlans } from '../models/schema.ts';
import { subjectsService } from './subjects.service.ts';
import { NotFoundError, ForbiddenError } from '../utils/errors.ts';
import { logger } from '../utils/logger.ts';
import { sanitizeString } from './auth.service.ts';

const memoryPlans = new Map<number, any>();
let nextPlanId = 600;

export interface DailyGoalItem {
  day: number;
  topic: string;
  tasks: string[];
  done: boolean;
}

export interface CreateStudyPlanInput {
  subjectId: number;
  title: string;
  targetDate?: string;
  dailyGoals?: DailyGoalItem[];
}

export interface UpdateStudyPlanInput {
  title?: string;
  targetDate?: string;
  dailyGoals?: DailyGoalItem[];
  isActive?: boolean;
}

export const studyPlanService = {
  async getStudyPlans(userId: string, subjectId?: number) {
    if (isDbActive()) {
      try {
        const conditions = [eq(studyPlans.userId, userId)];
        if (subjectId) {
          conditions.push(eq(studyPlans.subjectId, subjectId));
        }

        const list = await db
          .select()
          .from(studyPlans)
          .where(and(...conditions))
          .orderBy(desc(studyPlans.createdAt));

        return list;
      } catch (err: any) {
        logger.debug(`Postgres getStudyPlans notice: ${err.message}`);
      }
    }

    let list = Array.from(memoryPlans.values()).filter((p) => p.userId === userId);
    if (subjectId) list = list.filter((p) => p.subjectId === subjectId);
    return list;
  },

  async getStudyPlanById(userId: string, planId: number) {
    if (isDbActive()) {
      try {
        const [found] = await db
          .select()
          .from(studyPlans)
          .where(eq(studyPlans.id, planId))
          .limit(1);

        if (found) {
          if (found.userId !== userId) {
            throw new ForbiddenError('You do not have permission to access this study plan');
          }
          return found;
        }
      } catch (err: any) {
        if (err instanceof ForbiddenError) throw err;
        logger.debug(`Postgres getStudyPlanById notice: ${err.message}`);
      }
    }

    const mem = memoryPlans.get(planId);
    if (!mem) throw new NotFoundError('Study plan not found');
    if (mem.userId !== userId) throw new ForbiddenError('You do not have permission to access this study plan');
    return mem;
  },

  async createStudyPlan(userId: string, data: CreateStudyPlanInput) {
    // 1. Authorize subject ownership
    await subjectsService.getSubjectById(userId, data.subjectId);

    const defaultGoals: DailyGoalItem[] = [
      { day: 1, topic: 'Fundamental Review', tasks: ['Read introductory notes', 'Create 5 flashcards'], done: false },
      { day: 2, topic: 'Key Equations & Mechanisms', tasks: ['Practice 3 problems', 'Review flashcards'], done: false },
      { day: 3, topic: 'Deep Dive & Practice Test', tasks: ['Complete timed quiz', 'Review mistakes'], done: false },
    ];

    const goals = data.dailyGoals && data.dailyGoals.length > 0 ? data.dailyGoals : defaultGoals;
    const planTitle = sanitizeString(data.title);

    if (isDbActive()) {
      try {
        const [created] = await db
          .insert(studyPlans)
          .values({
            userId,
            subjectId: data.subjectId,
            title: planTitle,
            targetDate: data.targetDate || null,
            dailyGoals: goals,
            isActive: true,
          })
          .returning();

        memoryPlans.set(created.id, created);
        return created;
      } catch (err: any) {
        logger.debug(`Postgres createStudyPlan notice: ${err.message}`);
      }
    }

    const newPlan = {
      id: ++nextPlanId,
      userId,
      subjectId: data.subjectId,
      title: planTitle,
      targetDate: data.targetDate || null,
      dailyGoals: goals,
      isActive: true,
      createdAt: new Date(),
    };
    memoryPlans.set(newPlan.id, newPlan);
    return newPlan;
  },

  async updateStudyPlan(userId: string, planId: number, data: UpdateStudyPlanInput) {
    // 1. Authorize ownership
    await this.getStudyPlanById(userId, planId);

    const planTitle = data.title ? sanitizeString(data.title) : undefined;

    if (isDbActive()) {
      try {
        const [updated] = await db
          .update(studyPlans)
          .set({
            ...(planTitle ? { title: planTitle } : {}),
            ...(data.targetDate !== undefined ? { targetDate: data.targetDate } : {}),
            ...(data.dailyGoals ? { dailyGoals: data.dailyGoals } : {}),
            ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
          })
          .where(and(eq(studyPlans.id, planId), eq(studyPlans.userId, userId)))
          .returning();

        if (updated) {
          memoryPlans.set(planId, updated);
          return updated;
        }
      } catch (err: any) {
        logger.debug(`Postgres updateStudyPlan notice: ${err.message}`);
      }
    }

    const mem = memoryPlans.get(planId);
    if (mem && mem.userId === userId) {
      if (planTitle) mem.title = planTitle;
      if (data.targetDate !== undefined) mem.targetDate = data.targetDate;
      if (data.dailyGoals) mem.dailyGoals = data.dailyGoals;
      if (data.isActive !== undefined) mem.isActive = data.isActive;
      return mem;
    }
    throw new NotFoundError('Study plan not found');
  },

  async deleteStudyPlan(userId: string, planId: number) {
    // 1. Authorize ownership
    await this.getStudyPlanById(userId, planId);

    if (isDbActive()) {
      try {
        await db
          .delete(studyPlans)
          .where(and(eq(studyPlans.id, planId), eq(studyPlans.userId, userId)));
        memoryPlans.delete(planId);
        return { success: true, message: 'Study plan deleted successfully' };
      } catch (err: any) {
        logger.debug(`Postgres deleteStudyPlan notice: ${err.message}`);
      }
    }

    memoryPlans.delete(planId);
    return { success: true, message: 'Study plan deleted successfully' };
  },
};
