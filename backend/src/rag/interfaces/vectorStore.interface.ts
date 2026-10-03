import { ChunkRecord, SearchOptions, SearchResult } from '../types.ts';

/**
 * Modular Vector Store Interface:
 * Allows swapping the underlying vector-capable database (PostgreSQL, PgVector, In-Memory, Pinecone, Qdrant)
 * without altering downstream retrieval or RAG logic.
 */
export interface IVectorStore {
  /**
   * Initializes store, tables, or index connections
   */
  init(): Promise<void>;

  /**
   * Saves or updates chunks along with their vector embeddings
   */
  saveChunks(chunks: ChunkRecord[]): Promise<void>;

  /**
   * Deletes all chunks associated with a specific study material
   */
  deleteChunksByMaterial(materialId: number, userId: string): Promise<void>;

  /**
   * Performs vector similarity search with cosine similarity scoring
   */
  similaritySearch(
    queryEmbedding: number[],
    options: SearchOptions,
  ): Promise<SearchResult[]>;

  /**
   * Performs hybrid search combining semantic vector similarity and keyword overlap
   */
  hybridSearch(
    queryText: string,
    queryEmbedding: number[],
    options: SearchOptions,
  ): Promise<SearchResult[]>;
}
