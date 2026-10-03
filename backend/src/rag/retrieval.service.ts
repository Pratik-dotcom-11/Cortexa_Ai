import { embeddingService } from './embedding.service.ts';
import { vectorStoreFactory } from './vectorStore.factory.ts';
import { RagContextResult, RagCitation, SearchOptions, ChunkRecord } from './types.ts';
import { logger } from '../utils/logger.ts';

export const retrievalService = {
  /**
   * Retrieves top relevant chunks for a student's query using vector embeddings & hybrid search.
   * Filters out low-similarity noise to prevent context bloat.
   */
  async retrieveContext(
    query: string,
    options: SearchOptions,
  ): Promise<RagContextResult> {
    const rawQuery = (query || '').trim();
    if (!rawQuery) {
      return {
        chunks: [],
        citations: [],
        isSufficient: false,
        topSimilarityScore: 0,
        queryEmbedding: [],
      };
    }

    // 1. Create embedding for the student's question
    const queryEmbedding = await embeddingService.generateEmbedding(rawQuery);

    // 2. Query the modular vector store for candidate chunks
    const store = vectorStoreFactory.getVectorStore();
    const searchResults = await store.hybridSearch(rawQuery, queryEmbedding, {
      ...options,
      topK: options.topK || 5,
      minSimilarityThreshold: options.minSimilarityThreshold || 0.35,
    });

    // 3. Relevance Filtering & Citation Extraction
    const relevantChunks: ChunkRecord[] = [];
    const citations: RagCitation[] = [];
    let topSimilarityScore = 0;

    for (const res of searchResults) {
      if (res.combinedScore > topSimilarityScore) {
        topSimilarityScore = res.combinedScore;
      }

      relevantChunks.push(res.chunk);

      // Create high-yield citation snippet
      const cleanSnippet = res.chunk.content
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 160) + (res.chunk.content.length > 160 ? '...' : '');

      citations.push({
        materialId: res.chunk.materialId,
        materialTitle: res.chunk.materialTitle || 'Course Study Material',
        chunkIndex: res.chunk.chunkIndex,
        pageNumber: res.chunk.pageNumber || 1,
        snippet: cleanSnippet,
        similarityScore: Math.round(res.combinedScore * 100) / 100,
      });
    }

    // 4. Determine Context Sufficiency
    // If top relevance is high or multiple relevant chunks matched, context is sufficient
    const isSufficient = relevantChunks.length > 0 && topSimilarityScore >= 0.40;

    logger.info(
      `RAG Retrieval for "${rawQuery.slice(0, 40)}...": Found ${relevantChunks.length} chunks (Top score: ${topSimilarityScore.toFixed(2)}, Sufficient: ${isSufficient})`,
    );

    return {
      chunks: relevantChunks,
      citations,
      isSufficient,
      topSimilarityScore,
      queryEmbedding,
    };
  },
};
