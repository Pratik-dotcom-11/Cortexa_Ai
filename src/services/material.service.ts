import { StudyMaterial, MaterialChunk, ApiResponse } from '../types';
import { storage } from './storage';

// Helper to chunk text logically into semantic windows
function createChunks(materialId: string, rawText: string): MaterialChunk[] {
  const paragraphs = rawText.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  if (paragraphs.length === 0) {
    return [
      {
        id: `chk-${materialId}-0`,
        materialId,
        chunkIndex: 0,
        content: rawText.slice(0, 1000),
        tokenCount: Math.round(rawText.slice(0, 1000).length / 4),
        pageNumber: 1,
      },
    ];
  }

  const chunks: MaterialChunk[] = [];
  let currentChunk = '';
  let chunkIdx = 0;
  let page = 1;

  for (const para of paragraphs) {
    if ((currentChunk + '\n' + para).length > 900 && currentChunk.length > 0) {
      chunks.push({
        id: `chk-${materialId}-${chunkIdx}`,
        materialId,
        chunkIndex: chunkIdx,
        content: currentChunk.trim(),
        tokenCount: Math.round(currentChunk.length / 4),
        pageNumber: page,
      });
      chunkIdx++;
      if (chunkIdx % 2 === 0) page++;
      currentChunk = para;
    } else {
      currentChunk = currentChunk ? currentChunk + '\n\n' + para : para;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push({
      id: `chk-${materialId}-${chunkIdx}`,
      materialId,
      chunkIndex: chunkIdx,
      content: currentChunk.trim(),
      tokenCount: Math.round(currentChunk.length / 4),
      pageNumber: page,
    });
  }

  return chunks;
}

export const materialService = {
  async getMaterials(subjectId?: string): Promise<ApiResponse<StudyMaterial[]>> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    let materials = storage.getMaterials();
    if (subjectId) {
      materials = materials.filter((m) => m.subjectId === subjectId);
    }
    return { success: true, data: materials };
  },

  async getMaterialById(id: string): Promise<ApiResponse<StudyMaterial | null>> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const materials = storage.getMaterials();
    const found = materials.find((m) => m.id === id);
    if (!found) return { success: false, data: null, error: 'Material not found' };
    return { success: true, data: found };
  },

  async uploadMaterial(params: {
    subjectId: string;
    title: string;
    fileType: 'pdf' | 'notes' | 'markdown' | 'doc';
    rawText: string;
    fileSizeBytes?: number;
  }): Promise<ApiResponse<StudyMaterial>> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const user = storage.getUser();
    const materialId = `mat-${Date.now().toString(36)}`;

    // Generate semantic chunks for document processing & RAG
    const chunks = createChunks(materialId, params.rawText);

    // Extract quick concept tags from capitalized phrases / keywords
    const words = params.rawText.match(/\b[A-Z][a-zA-Z0-9-]{3,}\b/g) || [];
    const uniqueKeywords = Array.from(new Set(words)).slice(0, 5);

    const newMaterial: StudyMaterial = {
      id: materialId,
      userId: user?.id || 'usr-student-01',
      subjectId: params.subjectId,
      title: params.title,
      fileType: params.fileType,
      fileSizeBytes: params.fileSizeBytes || params.rawText.length * 2,
      rawText: params.rawText,
      summary: `Automated summary ready. Contains ${chunks.length} key indexed sections spanning ${uniqueKeywords.join(', ') || 'fundamental topics'}.`,
      keyConcepts: uniqueKeywords.length > 0 ? uniqueKeywords : ['Core Concepts', 'Overview', 'Key Analysis'],
      chunksCount: chunks.length,
      chunks,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const materials = storage.getMaterials();
    materials.unshift(newMaterial);
    storage.setMaterials(materials);

    return {
      success: true,
      data: newMaterial,
      message: 'Document processed and chunked successfully',
    };
  },

  async searchMaterials(query: string, subjectId?: string): Promise<ApiResponse<MaterialChunk[]>> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const materials = storage.getMaterials();
    const targetMats = subjectId ? materials.filter((m) => m.subjectId === subjectId) : materials;
    const lowerQuery = query.toLowerCase();

    const matchedChunks: MaterialChunk[] = [];
    for (const mat of targetMats) {
      if (mat.chunks) {
        for (const chunk of mat.chunks) {
          if (chunk.content.toLowerCase().includes(lowerQuery)) {
            matchedChunks.push(chunk);
          }
        }
      }
    }

    return { success: true, data: matchedChunks };
  },

  async deleteMaterial(id: string): Promise<ApiResponse<null>> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const materials = storage.getMaterials().filter((m) => m.id !== id);
    storage.setMaterials(materials);
    return { success: true, data: null, message: 'Material deleted' };
  },
};
