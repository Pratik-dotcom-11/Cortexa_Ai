import { eq, and, desc, sql } from 'drizzle-orm';
import { db, isDbActive } from '../config/database.ts';
import { subjects, studyMaterials, quizzes, flashcards } from '../models/schema.ts';
import { NotFoundError, ForbiddenError } from '../utils/errors.ts';
import { logger } from '../utils/logger.ts';
import { sanitizeString } from './auth.service.ts';

// In-memory fallback if PostgreSQL is temporarily unavailable in development
const memorySubjects = new Map<number, any>();
let nextSubjectId = 100;

export interface CreateSubjectData {
  name: string;
  code?: string;
  color?: string;
  description?: string;
}

export interface UpdateSubjectData {
  name?: string;
  code?: string;
  color?: string;
  description?: string;
}

export const subjectsService = {
  async getSubjects(userId: string) {
    if (isDbActive()) {
      try {
        const list = await db
          .select()
          .from(subjects)
          .where(eq(subjects.userId, userId))
          .orderBy(desc(subjects.createdAt));

        // Attach associated counts for each subject
        const enriched = await Promise.all(
          list.map(async (subj) => {
            const [mats] = await db
              .select({ count: sql<number>`count(*)::int` })
              .from(studyMaterials)
              .where(and(eq(studyMaterials.userId, userId), eq(studyMaterials.subjectId, subj.id)));

            const [quizCount] = await db
              .select({ count: sql<number>`count(*)::int` })
              .from(quizzes)
              .where(and(eq(quizzes.userId, userId), eq(quizzes.subjectId, subj.id)));

            const [cardCount] = await db
              .select({ count: sql<number>`count(*)::int` })
              .from(flashcards)
              .where(and(eq(flashcards.userId, userId), eq(flashcards.subjectId, subj.id)));

            return {
              ...subj,
              materialsCount: mats?.count || 0,
              quizzesCount: quizCount?.count || 0,
              flashcardsCount: cardCount?.count || 0,
            };
          }),
        );

        return enriched;
      } catch (err: any) {
        logger.debug(`Postgres getSubjects notice: ${err.message}`);
      }
    }

    const userSubs = Array.from(memorySubjects.values()).filter((s) => s.userId === userId);
    return userSubs;
  },

  async getSubjectById(userId: string, subjectId: number) {
    if (isDbActive()) {
      try {
        const [found] = await db
          .select()
          .from(subjects)
          .where(eq(subjects.id, subjectId))
          .limit(1);

        if (found) {
          // Security Check: Authorize resource by user ID
          if (found.userId !== userId) {
            throw new ForbiddenError('You do not have permission to access this subject');
          }

          const [mats] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(studyMaterials)
            .where(and(eq(studyMaterials.userId, userId), eq(studyMaterials.subjectId, subjectId)));

          const [quizCount] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(quizzes)
            .where(and(eq(quizzes.userId, userId), eq(quizzes.subjectId, subjectId)));

          const [cardCount] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(flashcards)
            .where(and(eq(flashcards.userId, userId), eq(flashcards.subjectId, subjectId)));

          return {
            ...found,
            materialsCount: mats?.count || 0,
            quizzesCount: quizCount?.count || 0,
            flashcardsCount: cardCount?.count || 0,
          };
        }
      } catch (err: any) {
        if (err instanceof ForbiddenError) throw err;
        logger.debug(`Postgres getSubjectById notice: ${err.message}`);
      }
    }

    const mem = memorySubjects.get(subjectId);
    if (!mem) throw new NotFoundError('Subject not found');
    if (mem.userId !== userId) throw new ForbiddenError('You do not have permission to access this subject');
    return mem;
  },

  async createSubject(userId: string, data: CreateSubjectData) {
    const safeName = sanitizeString(data.name);
    const safeCode = data.code ? sanitizeString(data.code) : null;
    const safeDesc = data.description ? sanitizeString(data.description) : null;

    if (isDbActive()) {
      try {
        const [created] = await db
          .insert(subjects)
          .values({
            userId,
            name: safeName,
            code: safeCode,
            color: data.color || '#6366f1',
            description: safeDesc,
          })
          .returning();

        const res = {
          ...created,
          materialsCount: 0,
          quizzesCount: 0,
          flashcardsCount: 0,
        };
        memorySubjects.set(created.id, res);
        return res;
      } catch (err: any) {
        logger.debug(`Postgres createSubject notice: ${err.message}`);
      }
    }

    const newSub = {
      id: ++nextSubjectId,
      userId,
      name: safeName,
      code: safeCode,
      color: data.color || '#6366f1',
      description: safeDesc,
      materialsCount: 0,
      quizzesCount: 0,
      flashcardsCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memorySubjects.set(newSub.id, newSub);
    return newSub;
  },

  async updateSubject(userId: string, subjectId: number, data: UpdateSubjectData) {
    // 1. Authorize ownership first
    await this.getSubjectById(userId, subjectId);

    const safeName = data.name ? sanitizeString(data.name) : undefined;
    const safeCode = data.code !== undefined ? (data.code ? sanitizeString(data.code) : null) : undefined;
    const safeDesc = data.description !== undefined ? (data.description ? sanitizeString(data.description) : null) : undefined;

    if (isDbActive()) {
      try {
        const [updated] = await db
          .update(subjects)
          .set({
            ...(safeName ? { name: safeName } : {}),
            ...(safeCode !== undefined ? { code: safeCode } : {}),
            ...(data.color ? { color: data.color } : {}),
            ...(safeDesc !== undefined ? { description: safeDesc } : {}),
            updatedAt: new Date(),
          })
          .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
          .returning();

        if (updated) {
          memorySubjects.set(subjectId, updated);
          return updated;
        }
      } catch (err: any) {
        logger.debug(`Postgres updateSubject notice: ${err.message}`);
      }
    }

    const mem = memorySubjects.get(subjectId);
    if (mem && mem.userId === userId) {
      if (safeName) mem.name = safeName;
      if (safeCode !== undefined) mem.code = safeCode;
      if (data.color) mem.color = data.color;
      if (safeDesc !== undefined) mem.description = safeDesc;
      mem.updatedAt = new Date();
      return mem;
    }
    throw new NotFoundError('Subject not found');
  },

  async deleteSubject(userId: string, subjectId: number) {
    // Authorize ownership first
    await this.getSubjectById(userId, subjectId);

    if (isDbActive()) {
      try {
        await db
          .delete(subjects)
          .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)));
        memorySubjects.delete(subjectId);
        return { success: true, message: 'Subject deleted successfully' };
      } catch (err: any) {
        logger.debug(`Postgres deleteSubject notice: ${err.message}`);
      }
    }

    memorySubjects.delete(subjectId);
    return { success: true, message: 'Subject deleted successfully' };
  },
};
