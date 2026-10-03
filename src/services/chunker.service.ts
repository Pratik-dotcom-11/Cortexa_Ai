export interface DocumentChunk {
  chunkIndex: number;
  content: string;
  tokenCount: number;
  pageNumber: number;
}

/**
 * Splits document raw text into semantic sliding-window chunks.
 * Designed for immediate full-text search and future pgvector RAG embeddings.
 */
export function chunkDocumentText(
  rawText: string,
  options: {
    chunkSizeWords?: number;
    overlapWords?: number;
    estimatedTokensPerWord?: number;
  } = {},
): DocumentChunk[] {
  const chunkSizeWords = options.chunkSizeWords || 450;
  const overlapWords = options.overlapWords || 60;
  const tokensPerWord = options.estimatedTokensPerWord || 1.33;

  if (!rawText || !rawText.trim()) {
    return [];
  }

  // Detect simulated or actual page breaks
  const pages = rawText.split(/(?:--- Page \d+ ---|\f|\n{3,})/g).filter((p) => p.trim());
  const chunks: DocumentChunk[] = [];
  let globalChunkIndex = 0;

  if (pages.length > 1) {
    pages.forEach((pageContent, pageIdx) => {
      const words = pageContent.trim().split(/\s+/);
      if (words.length === 0 || (words.length === 1 && !words[0])) return;

      let start = 0;
      while (start < words.length) {
        const slice = words.slice(start, start + chunkSizeWords);
        const text = slice.join(' ');
        chunks.push({
          chunkIndex: globalChunkIndex++,
          content: text,
          tokenCount: Math.round(slice.length * tokensPerWord),
          pageNumber: pageIdx + 1,
        });
        if (start + chunkSizeWords >= words.length) break;
        start += chunkSizeWords - overlapWords;
      }
    });
  } else {
    // Single page or continuous stream
    const words = rawText.trim().split(/\s+/);
    let start = 0;
    while (start < words.length) {
      const slice = words.slice(start, start + chunkSizeWords);
      const text = slice.join(' ');
      chunks.push({
        chunkIndex: globalChunkIndex++,
        content: text,
        tokenCount: Math.round(slice.length * tokensPerWord),
        pageNumber: Math.floor(start / 500) + 1,
      });
      if (start + chunkSizeWords >= words.length) break;
      start += chunkSizeWords - overlapWords;
    }
  }

  return chunks;
}
