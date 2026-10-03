/**
 * Core Type Definitions for Modular Retrieval-Augmented Generation (RAG)
 */

export interface ChunkRecord {
  id?: number;
  materialId: number;
  userId: string;
  chunkIndex: number;
  content: string;
  pageNumber: number;
  tokenCount: number;
  embedding?: number[];
  materialTitle?: string;
  subjectId?: number;
  createdAt?: Date;
}

export interface SearchOptions {
  userId: string;
  materialId?: number;
  subjectId?: number;
  topK?: number; // Default 4
  minSimilarityThreshold?: number; // e.g. 0.40
}

export interface SearchResult {
  chunk: ChunkRecord;
  similarity: number; // 0.0 to 1.0 (Cosine similarity)
  bm25Score?: number;
  combinedScore: number;
}

export interface RagCitation {
  materialId?: number;
  materialTitle?: string;
  chunkIndex?: number;
  pageNumber?: number;
  snippet: string;
  similarityScore: number;
}

export interface RagContextResult {
  chunks: ChunkRecord[];
  citations: RagCitation[];
  isSufficient: boolean;
  topSimilarityScore: number;
  queryEmbedding: number[];
}

export interface RagQueryResult {
  answer: string;
  isGroundedInMaterial: boolean;
  isSufficient: boolean;
  confidence: 'grounded' | 'general_knowledge' | 'partial';
  citations: RagCitation[];
  retrievedChunksCount: number;
  topSimilarityScore: number;
  suggestedFollowUps?: string[];
}
