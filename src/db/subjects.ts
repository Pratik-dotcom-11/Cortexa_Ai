import { db } from './index.ts';
import { subjects, studyMaterials, quizzes, flashcards, topicProgress } from './schema.ts';
import { eq, and, desc, sql } from 'drizzle-orm';

export async function getSubjectsByUser(userId: string) {
  try {
    const list = await db
      .select()
      .from(subjects)
      .where(eq(subjects.userId, userId))
      .orderBy(desc(subjects.createdAt));

    // For each subject, attach counts
    const enriched = await Promise.all(
      list.map(async (subj) => {
        const [materialsCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(studyMaterials)
          .where(and(eq(studyMaterials.userId, userId), eq(studyMaterials.subjectId, subj.id)));

        const [quizzesCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(quizzes)
          .where(and(eq(quizzes.userId, userId), eq(quizzes.subjectId, subj.id)));

        const [flashcardsCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(flashcards)
          .where(and(eq(flashcards.userId, userId), eq(flashcards.subjectId, subj.id)));

        return {
          ...subj,
          materialsCount: materialsCount?.count || 0,
          quizzesCount: quizzesCount?.count || 0,
          flashcardsCount: flashcardsCount?.count || 0,
        };
      }),
    );

    return enriched;
  } catch (error) {
    console.error('Error in getSubjectsByUser:', error);
    throw new Error('Failed to load subjects', { cause: error });
  }
}

export async function createSubject(
  userId: string,
  data: { name: string; code?: string; color?: string; description?: string },
) {
  try {
    const [created] = await db
      .insert(subjects)
      .values({
        userId,
        name: data.name,
        code: data.code || null,
        color: data.color || '#6366f1',
        description: data.description || null,
      })
      .returning();
    return created;
  } catch (error) {
    console.error('Error in createSubject:', error);
    throw new Error('Failed to create subject', { cause: error });
  }
}

export async function getSubjectById(userId: string, subjectId: number) {
  try {
    const [found] = await db
      .select()
      .from(subjects)
      .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
      .limit(1);
    return found || null;
  } catch (error) {
    console.error('Error in getSubjectById:', error);
    throw new Error('Failed to fetch subject', { cause: error });
  }
}

export async function updateSubject(
  userId: string,
  subjectId: number,
  data: { name?: string; code?: string; color?: string; description?: string },
) {
  try {
    const [updated] = await db
      .update(subjects)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
      .returning();
    return updated || null;
  } catch (error) {
    console.error('Error in updateSubject:', error);
    throw new Error('Failed to update subject', { cause: error });
  }
}

export async function deleteSubject(userId: string, subjectId: number) {
  try {
    await db
      .delete(subjects)
      .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)));
    return true;
  } catch (error) {
    console.error('Error in deleteSubject:', error);
    throw new Error('Failed to delete subject', { cause: error });
  }
}
