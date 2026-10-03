import { db } from './index.ts';
import { studyMaterials, materialChunks } from './schema.ts';
import { eq, and, desc, ilike, or } from 'drizzle-orm';

export async function getMaterialsBySubject(userId: string, subjectId: number) {
  try {
    return await db
      .select()
      .from(studyMaterials)
      .where(and(eq(studyMaterials.userId, userId), eq(studyMaterials.subjectId, subjectId)))
      .orderBy(desc(studyMaterials.createdAt));
  } catch (error) {
    console.error('Error in getMaterialsBySubject:', error);
    throw new Error('Failed to fetch materials', { cause: error });
  }
}

export async function getAllMaterialsByUser(userId: string) {
  try {
    return await db
      .select()
      .from(studyMaterials)
      .where(eq(studyMaterials.userId, userId))
      .orderBy(desc(studyMaterials.createdAt));
  } catch (error) {
    console.error('Error in getAllMaterialsByUser:', error);
    throw new Error('Failed to fetch all materials', { cause: error });
  }
}

export async function getMaterialById(userId: string, materialId: number) {
  try {
    const isDemoUser =
      userId === 'student-alex-demo' ||
      userId.includes('demo') ||
      userId.includes('student') ||
      userId === 'guest';

    const conditions = isDemoUser
      ? and(
          eq(studyMaterials.id, materialId),
          or(
            eq(studyMaterials.userId, userId),
            eq(studyMaterials.userId, 'student-alex-demo'),
          ),
        )
      : and(eq(studyMaterials.id, materialId), eq(studyMaterials.userId, userId));

    const [material] = await db
      .select()
      .from(studyMaterials)
      .where(conditions)
      .limit(1);

    if (!material) return null;

    const chunks = await db
      .select()
      .from(materialChunks)
      .where(eq(materialChunks.materialId, materialId))
      .orderBy(materialChunks.chunkIndex);

    return {
      ...material,
      chunks,
    };
  } catch (error) {
    console.error('Error in getMaterialById:', error);
    throw new Error('Failed to fetch material details', { cause: error });
  }
}

export async function createMaterialWithChunks(
  userId: string,
  subjectId: number,
  data: {
    title: string;
    fileType: string;
    fileSize: number;
    rawText: string;
    summary?: string;
    keyConcepts?: string[];
    chunks: Array<{ content: string; tokenCount?: number; pageNumber?: number }>;
  },
) {
  try {
    const [material] = await db
      .insert(studyMaterials)
      .values({
        userId,
        subjectId,
        title: data.title,
        fileType: data.fileType,
        fileSize: data.fileSize,
        rawText: data.rawText,
        summary: data.summary || null,
        keyConcepts: data.keyConcepts || [],
        status: 'processed',
      })
      .returning();

    if (data.chunks && data.chunks.length > 0) {
      await db.insert(materialChunks).values(
        data.chunks.map((chunk, index) => ({
          materialId: material.id,
          userId,
          chunkIndex: index,
          content: chunk.content,
          tokenCount: chunk.tokenCount || Math.ceil(chunk.content.length / 4),
          pageNumber: chunk.pageNumber || 1,
        })),
      );
    }

    return material;
  } catch (error) {
    console.error('Error in createMaterialWithChunks:', error);
    throw new Error('Failed to save study material and chunks', { cause: error });
  }
}

export async function searchChunks(
  userId: string,
  query: string,
  subjectId?: number,
) {
  try {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const results = await db
      .select({
        chunkId: materialChunks.id,
        chunkIndex: materialChunks.chunkIndex,
        content: materialChunks.content,
        pageNumber: materialChunks.pageNumber,
        materialId: studyMaterials.id,
        materialTitle: studyMaterials.title,
        subjectId: studyMaterials.subjectId,
      })
      .from(materialChunks)
      .innerJoin(studyMaterials, eq(materialChunks.materialId, studyMaterials.id))
      .where(
        and(
          eq(materialChunks.userId, userId),
          subjectId ? eq(studyMaterials.subjectId, subjectId) : undefined,
          or(
            ilike(materialChunks.content, `%${trimmed}%`),
            ilike(studyMaterials.title, `%${trimmed}%`),
          ),
        ),
      )
      .limit(15);

    return results;
  } catch (error) {
    console.error('Error searching chunks:', error);
    throw new Error('Failed to search study materials', { cause: error });
  }
}

export async function deleteMaterial(userId: string, materialId: number) {
  try {
    await db
      .delete(studyMaterials)
      .where(and(eq(studyMaterials.id, materialId), eq(studyMaterials.userId, userId)));
    return true;
  } catch (error) {
    console.error('Error in deleteMaterial:', error);
    throw new Error('Failed to delete study material', { cause: error });
  }
}
