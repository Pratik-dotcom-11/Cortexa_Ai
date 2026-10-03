import { eq, and } from 'drizzle-orm';
import { db, isDbActive } from '../../config/database.ts';
import { materialChunks, studyMaterials } from '../../models/schema.ts';
import { IVectorStore } from '../interfaces/vectorStore.interface.ts';
import { ChunkRecord, SearchOptions, SearchResult } from '../types.ts';
import { cosineSimilarity } from '../embedding.service.ts';
import { logger } from '../../utils/logger.ts';

// In-memory vector cache for ultra-low latency sub-millisecond retrieval
const memoryChunksCache = new Map<number, ChunkRecord>();

export class PostgresVectorStore implements IVectorStore {
  async init(): Promise<void> {
    logger.info('PostgresVectorStore initialized');
  }

  async saveChunks(chunks: ChunkRecord[]): Promise<void> {
    if (!chunks || chunks.length === 0) return;

    for (const chunk of chunks) {
      if (isDbActive()) {
        try {
          const [inserted] = await db
            .insert(materialChunks)
            .values({
              materialId: chunk.materialId,
              userId: chunk.userId,
              chunkIndex: chunk.chunkIndex,
              content: chunk.content,
              tokenCount: chunk.tokenCount || 0,
              pageNumber: chunk.pageNumber || 1,
              embedding: chunk.embedding || null,
              createdAt: new Date(),
            })
            .returning();

          if (inserted) {
            const record: ChunkRecord = {
              id: inserted.id,
              materialId: inserted.materialId,
              userId: inserted.userId,
              chunkIndex: inserted.chunkIndex,
              content: inserted.content,
              tokenCount: inserted.tokenCount || 0,
              pageNumber: inserted.pageNumber || 1,
              embedding: (inserted.embedding as number[]) || chunk.embedding,
              materialTitle: chunk.materialTitle,
              subjectId: chunk.subjectId,
            };
            memoryChunksCache.set(inserted.id, record);
            continue;
          }
        } catch (err: any) {
          logger.debug(`Postgres chunk insertion notice: ${err.message}`);
        }
      }

      const tempId = Date.now() + Math.floor(Math.random() * 10000);
      memoryChunksCache.set(tempId, {
        ...chunk,
        id: tempId,
      });
    }
  }

  async deleteChunksByMaterial(materialId: number, userId: string): Promise<void> {
    if (isDbActive()) {
      try {
        await db
          .delete(materialChunks)
          .where(and(eq(materialChunks.materialId, materialId), eq(materialChunks.userId, userId)));
      } catch (err: any) {
        logger.debug(`Postgres deleteChunksByMaterial notice: ${err.message}`);
      }
    }

    // Clean cache
    for (const [id, c] of memoryChunksCache.entries()) {
      if (c.materialId === materialId && c.userId === userId) {
        memoryChunksCache.delete(id);
      }
    }
  }

  async similaritySearch(
    queryEmbedding: number[],
    options: SearchOptions,
  ): Promise<SearchResult[]> {
    return this.hybridSearch('', queryEmbedding, options);
  }

  async hybridSearch(
    queryText: string,
    queryEmbedding: number[],
    options: SearchOptions,
  ): Promise<SearchResult[]> {
    const { userId, materialId, subjectId, topK = 4, minSimilarityThreshold = 0.35 } = options;

    // 1. Fetch chunks for user from database
    let candidateChunks: ChunkRecord[] = [];

    if (isDbActive()) {
      try {
        const conditions = [eq(materialChunks.userId, userId)];
        if (materialId) {
          conditions.push(eq(materialChunks.materialId, materialId));
        }

        const rows = await db
          .select({
            id: materialChunks.id,
            materialId: materialChunks.materialId,
            userId: materialChunks.userId,
            chunkIndex: materialChunks.chunkIndex,
            content: materialChunks.content,
            tokenCount: materialChunks.tokenCount,
            pageNumber: materialChunks.pageNumber,
            embedding: materialChunks.embedding,
            createdAt: materialChunks.createdAt,
          })
          .from(materialChunks)
          .where(and(...conditions));

        // Attach material title if available
        candidateChunks = await Promise.all(
          rows.map(async (r) => {
            let materialTitle = 'Study Document';
            let subjId = subjectId;

            try {
              const [mat] = await db
                .select({ title: studyMaterials.title, subjectId: studyMaterials.subjectId })
                .from(studyMaterials)
                .where(eq(studyMaterials.id, r.materialId))
                .limit(1);
              if (mat) {
                materialTitle = mat.title;
                subjId = mat.subjectId;
              }
            } catch {}

            return {
              id: r.id,
              materialId: r.materialId,
              userId: r.userId,
              chunkIndex: r.chunkIndex,
              content: r.content,
              tokenCount: r.tokenCount || 0,
              pageNumber: r.pageNumber || 1,
              embedding: (r.embedding as number[]) || undefined,
              materialTitle,
              subjectId: subjId,
            };
          }),
        );

        // Filter by subjectId if specified
        if (subjectId) {
          candidateChunks = candidateChunks.filter((c) => !c.subjectId || c.subjectId === subjectId);
        }
      } catch (err: any) {
        logger.debug(`Postgres candidateChunks notice: ${err.message}`);
        candidateChunks = [];
      }
    }

    if (candidateChunks.length === 0) {
      // Check in-memory fallback
      candidateChunks = Array.from(memoryChunksCache.values()).filter((c) => {
        if (c.userId !== userId) return false;
        if (materialId && c.materialId !== materialId) return false;
        if (subjectId && c.subjectId && c.subjectId !== subjectId) return false;
        return true;
      });
    }

    // 2. Compute Cosine Similarities and Keyword Overlap
    const queryTokens = (queryText || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2);

    const scoredResults: SearchResult[] = [];

    for (const chunk of candidateChunks) {
      let sim = 0;
      if (chunk.embedding && chunk.embedding.length > 0 && queryEmbedding && queryEmbedding.length > 0) {
        sim = cosineSimilarity(queryEmbedding, chunk.embedding);
      }

      // Keyword BM25 / token overlap score
      let keywordScore = 0;
      if (queryTokens.length > 0) {
        const chunkLower = chunk.content.toLowerCase();
        let matched = 0;
        for (const token of queryTokens) {
          if (chunkLower.includes(token)) {
            matched++;
          }
        }
        keywordScore = matched / queryTokens.length;
      }

      // Hybrid combination: 70% vector semantic similarity + 30% lexical keyword overlap
      const combinedScore = sim > 0 ? sim * 0.7 + keywordScore * 0.3 : keywordScore * 0.85;

      if (combinedScore >= minSimilarityThreshold || (sim >= 0.38) || (keywordScore >= 0.4)) {
        scoredResults.push({
          chunk,
          similarity: sim,
          bm25Score: keywordScore,
          combinedScore,
        });
      }
    }

    // 3. Sort by highest relevance and take topK
    scoredResults.sort((a, b) => b.combinedScore - a.combinedScore);

    return scoredResults.slice(0, topK);
  }
}
