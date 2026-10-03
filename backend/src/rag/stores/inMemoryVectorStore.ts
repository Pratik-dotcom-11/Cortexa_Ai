import { IVectorStore } from '../interfaces/vectorStore.interface.ts';
import { ChunkRecord, SearchOptions, SearchResult } from '../types.ts';
import { cosineSimilarity } from '../embedding.service.ts';

export class InMemoryVectorStore implements IVectorStore {
  private chunks: Map<number, ChunkRecord> = new Map();
  private nextId = 1000;

  async init(): Promise<void> {}

  async saveChunks(newChunks: ChunkRecord[]): Promise<void> {
    for (const chunk of newChunks) {
      const id = chunk.id || ++this.nextId;
      this.chunks.set(id, {
        ...chunk,
        id,
      });
    }
  }

  async deleteChunksByMaterial(materialId: number, userId: string): Promise<void> {
    for (const [id, c] of this.chunks.entries()) {
      if (c.materialId === materialId && c.userId === userId) {
        this.chunks.delete(id);
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

    const candidates = Array.from(this.chunks.values()).filter((c) => {
      if (c.userId !== userId) return false;
      if (materialId && c.materialId !== materialId) return false;
      if (subjectId && c.subjectId && c.subjectId !== subjectId) return false;
      return true;
    });

    const queryTokens = (queryText || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2);

    const scored: SearchResult[] = [];

    for (const chunk of candidates) {
      let sim = 0;
      if (chunk.embedding && chunk.embedding.length > 0 && queryEmbedding && queryEmbedding.length > 0) {
        sim = cosineSimilarity(queryEmbedding, chunk.embedding);
      }

      let keywordScore = 0;
      if (queryTokens.length > 0) {
        const chunkLower = chunk.content.toLowerCase();
        let matched = 0;
        for (const token of queryTokens) {
          if (chunkLower.includes(token)) matched++;
        }
        keywordScore = matched / queryTokens.length;
      }

      const combinedScore = sim > 0 ? sim * 0.7 + keywordScore * 0.3 : keywordScore * 0.85;

      if (combinedScore >= minSimilarityThreshold || sim >= 0.38 || keywordScore >= 0.4) {
        scored.push({
          chunk,
          similarity: sim,
          bm25Score: keywordScore,
          combinedScore,
        });
      }
    }

    scored.sort((a, b) => b.combinedScore - a.combinedScore);
    return scored.slice(0, topK);
  }
}
