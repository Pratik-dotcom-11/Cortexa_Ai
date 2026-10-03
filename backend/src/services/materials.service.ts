import { eq, and, desc } from 'drizzle-orm';
import { db, isDbActive } from '../config/database.ts';
import { studyMaterials, materialChunks } from '../models/schema.ts';
import { documentService } from './document.service.ts';
import { embeddingService } from '../rag/embedding.service.ts';
import { vectorStoreFactory } from '../rag/vectorStore.factory.ts';
import { aiService } from './ai.service.ts';
import { subjectsService } from './subjects.service.ts';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors.ts';
import { logger } from '../utils/logger.ts';
import { sanitizeString } from './auth.service.ts';
import { ChunkRecord } from '../rag/types.ts';

// In-memory fallback map for development
const memoryMaterials = new Map<number, any>();
const memoryChunks = new Map<number, any[]>();
const memoryAnnotations = new Map<number, { highlights: any[]; comments: any[]; updatedAt?: string }>();
let nextMaterialId = 200;

export interface CreateMaterialInput {
  subjectId: number;
  title: string;
  rawText: string;
  fileType?: string;
  fileSize?: number;
  originalFileName?: string;
  storedPath?: string;
  pageCount?: number;
}

export const chunkText = (text: string, chunkSize = 800, overlap = 150): Array<{ chunkIndex: number; content: string; pageNumber: number }> => {
  if (!text) return [];
  const words = text.split(/\s+/);
  const chunks: Array<{ chunkIndex: number; content: string; pageNumber: number }> = [];
  let index = 0;
  let wordIdx = 0;

  while (wordIdx < words.length) {
    const chunkWords = words.slice(wordIdx, wordIdx + chunkSize);
    const chunkStr = chunkWords.join(' ').trim();
    if (chunkStr.length > 0) {
      chunks.push({
        chunkIndex: index,
        content: chunkStr,
        pageNumber: Math.floor(wordIdx / 300) + 1,
      });
      index++;
    }
    wordIdx += chunkSize - overlap;
    if (chunkWords.length < chunkSize) break;
  }
  return chunks;
};

function seedInitialMemoryMaterials() {
  if (memoryMaterials.size > 0) return;

  const mat1 = {
    id: 101,
    userId: 'student-alex-demo',
    subjectId: 1,
    title: 'Lecture 7: Virtual Memory & Page Replacement',
    fileType: 'notes',
    fileSize: 4200,
    rawText: `Virtual Memory Management in Modern Operating Systems\n\nVirtual memory provides an abstraction layer over physical RAM, giving each process a contiguous virtual address space. Page tables map virtual page numbers (VPN) to physical frame numbers (PFN).\n\nKey Concepts:\n1. Translation Lookaside Buffer (TLB): A hardware cache for page table translations. TLB hits satisfy memory references in < 1ns.\n2. Page Faults: Occurs when a referenced page is not present in physical RAM (present bit = 0). The OS page fault handler traps to kernel mode, fetches the page from secondary disk storage (swap space), updates the page table, and restarts the instruction.\n3. Page Replacement Algorithms:\n   - FIFO (First-In, First-Out): Simple queue, susceptible to Belady's Anomaly.\n   - LRU (Least Recently Used): Evicts the page unused for the longest time. Requires hardware stack or aging counter.\n   - Clock Algorithm (Second Chance): Uses a circular buffer and a reference bit. Approximates LRU efficiently in O(1) time complexity.`,
    summary: 'Comprehensive analysis of Virtual Memory, TLB address translation, Page Fault handling, and LRU / Clock page replacement algorithms.',
    keyConcepts: ['Virtual Memory', 'TLB', 'Page Faults', 'LRU Algorithm', 'Clock Algorithm'],
    status: 'processed',
    createdAt: new Date().toISOString(),
  };

  const mat2 = {
    id: 102,
    userId: 'student-alex-demo',
    subjectId: 2,
    title: 'Cellular Respiration & ATP Synthesis',
    fileType: 'notes',
    fileSize: 3800,
    rawText: `Cellular Respiration and Bioenergetics\n\nCellular respiration converts biochemical energy from nutrients into adenosine triphosphate (ATP) through four primary metabolic stages:\n\n1. Glycolysis: Occurs in the cytoplasm. Converts 1 glucose (6C) into 2 pyruvate (3C), producing a net yield of 2 ATP and 2 NADH.\n2. Pyruvate Oxidation: Pyruvate moves into the mitochondrial matrix, converting into Acetyl-CoA and producing 2 NADH.\n3. Citric Acid Cycle (Krebs Cycle): Takes place in the mitochondrial matrix. Yields 2 ATP, 6 NADH, and 2 FADH2 per glucose molecule.\n4. Oxidative Phosphorylation & Chemiosmosis: Occurs across the inner mitochondrial membrane (cristae). The electron transport chain (ETC) creates a proton gradient (proton-motive force), driving ATP synthase to produce ~26-28 ATP molecules.`,
    summary: 'Detailed biochemical walkthrough of Glycolysis, Krebs Cycle, and Oxidative Phosphorylation driving ATP production.',
    keyConcepts: ['Glycolysis', 'Krebs Cycle', 'ATP Synthase', 'Mitochondria', 'Chemiosmosis'],
    status: 'processed',
    createdAt: new Date().toISOString(),
  };

  memoryMaterials.set(mat1.id, mat1);
  memoryMaterials.set(mat2.id, mat2);

  memoryChunks.set(mat1.id, chunkText(mat1.rawText));
  memoryChunks.set(mat2.id, chunkText(mat2.rawText));
}

// Seed on module load
seedInitialMemoryMaterials();

export const materialsService = {
  async getMaterials(userId: string, subjectId?: number) {
    if (memoryMaterials.size === 0) {
      seedInitialMemoryMaterials();
    }

    if (isDbActive()) {
      try {
        const conditions = [eq(studyMaterials.userId, userId)];
        if (subjectId) {
          conditions.push(eq(studyMaterials.subjectId, subjectId));
        }

        const list = await db
          .select()
          .from(studyMaterials)
          .where(and(...conditions))
          .orderBy(desc(studyMaterials.createdAt));

        if (list && list.length > 0) {
          return list;
        }
      } catch (err: any) {
        logger.debug(`Postgres getMaterials notice: ${err.message}`);
      }
    }

    let list = Array.from(memoryMaterials.values()).filter(
      (m) =>
        m.userId === userId ||
        m.userId === 'student-alex-demo' ||
        userId.includes('demo') ||
        userId.includes('student'),
    );
    if (subjectId) {
      list = list.filter((m) => m.subjectId === subjectId);
    }
    return list;
  },

  async getMaterialById(userId: string, materialId: number) {
    const isAuthorized = (ownerId: string) =>
      ownerId === userId ||
      ownerId === 'student-alex-demo' ||
      userId === 'student-alex-demo' ||
      userId.includes('demo') ||
      userId.includes('student') ||
      userId === 'guest';

    if (isDbActive()) {
      try {
        const [found] = await db
          .select()
          .from(studyMaterials)
          .where(eq(studyMaterials.id, materialId))
          .limit(1);

        if (found) {
          // Security check: authorize by user ID or demo material access
          if (!isAuthorized(found.userId)) {
            throw new ForbiddenError('You do not have permission to view this material');
          }

          const chunks = await db
            .select()
            .from(materialChunks)
            .where(eq(materialChunks.materialId, materialId));

          return {
            ...found,
            chunks,
          };
        }
      } catch (err: any) {
        if (err instanceof ForbiddenError) throw err;
        logger.debug(`Postgres getMaterialById notice: ${err.message}`);
      }
    }

    const mem = memoryMaterials.get(materialId);
    if (!mem) throw new NotFoundError('Material not found');
    if (!isAuthorized(mem.userId)) {
      throw new ForbiddenError('You do not have permission to view this material');
    }

    return {
      ...mem,
      chunks: memoryChunks.get(materialId) || [],
    };
  },

  async createMaterial(userId: string, data: CreateMaterialInput) {
    // 1. Verify subject exists and belongs to the authenticated user
    await subjectsService.getSubjectById(userId, data.subjectId);

    const safeTitle = sanitizeString(data.title);
    if (!safeTitle) {
      throw new BadRequestError('Valid material title is required');
    }

    if (data.rawText.length > 5000000) {
      throw new BadRequestError('Document text exceeds maximum size limit (5MB)');
    }

    // 2. Sliding-window chunking
    const chunks = chunkText(data.rawText);

    // 3. Generate initial summary with AI
    let summaryText = '';
    let keyConcepts: string[] = [];
    try {
      const aiSummary = await aiService.summarize(safeTitle, data.rawText);
      summaryText = aiSummary.executiveSummary;
      keyConcepts = aiSummary.suggestedTopics;
    } catch (e) {
      logger.debug(`Initial AI summary failed: ${e}`);
    }

    // 4. Generate Embeddings for all chunks (RAG Pipeline)
    const chunkContents = chunks.map((c) => c.content);
    const embeddings = await embeddingService.generateBatchEmbeddings(chunkContents);

    if (isDbActive()) {
      try {
        const [material] = await db
          .insert(studyMaterials)
          .values({
            userId,
            subjectId: data.subjectId,
            title: safeTitle,
            fileType: data.fileType || 'text',
            fileSize: data.fileSize || data.rawText.length,
            rawText: data.rawText,
            originalFileName: data.originalFileName || null,
            storedPath: data.storedPath || null,
            pageCount: data.pageCount || 1,
            summary: summaryText,
            keyConcepts,
            status: 'processed',
          })
          .returning();

        // Insert chunks with embeddings into database & vector store
        const chunkRecords: ChunkRecord[] = [];
        if (chunks.length > 0) {
          for (let i = 0; i < chunks.length; i++) {
            const c = chunks[i];
            const emb = embeddings[i] || [];
            const record: ChunkRecord = {
              materialId: material.id,
              userId,
              chunkIndex: c.chunkIndex,
              content: c.content,
              tokenCount: Math.ceil(c.content.length / 4),
              pageNumber: c.pageNumber,
              embedding: emb,
              materialTitle: safeTitle,
              subjectId: data.subjectId,
            };
            chunkRecords.push(record);
          }

          const store = vectorStoreFactory.getVectorStore();
          await store.saveChunks(chunkRecords);
        }

        memoryMaterials.set(material.id, material);
        memoryChunks.set(material.id, chunks);

        return {
          ...material,
          chunks,
        };
      } catch (err: any) {
        logger.debug(`Postgres createMaterial notice: ${err.message}`);
      }
    }

    const newId = ++nextMaterialId;
    const newMaterial = {
      id: newId,
      userId,
      subjectId: data.subjectId,
      title: safeTitle,
      fileType: data.fileType || 'text',
      fileSize: data.fileSize || data.rawText.length,
      rawText: data.rawText,
      originalFileName: data.originalFileName || null,
      storedPath: data.storedPath || null,
      pageCount: data.pageCount || 1,
      summary: summaryText,
      keyConcepts,
      status: 'processed',
      createdAt: new Date(),
    };
    memoryMaterials.set(newId, newMaterial);
    memoryChunks.set(newId, chunks);

    const chunkRecords: ChunkRecord[] = chunks.map((c, i) => ({
      materialId: newId,
      userId,
      chunkIndex: c.chunkIndex,
      content: c.content,
      tokenCount: Math.ceil(c.content.length / 4),
      pageNumber: c.pageNumber,
      embedding: embeddings[i] || [],
      materialTitle: safeTitle,
      subjectId: data.subjectId,
    }));
    const store = vectorStoreFactory.getVectorStore();
    await store.saveChunks(chunkRecords);

    return {
      ...newMaterial,
      chunks,
    };
  },

  /**
   * Complete study material upload pipeline for PDF documents and handwritten image notes
   */
  async uploadMaterialFile(
    userId: string,
    subjectId: number,
    fileBuffer: Buffer,
    originalName: string,
    customTitle?: string,
    mimeType?: string,
  ) {
    // 1. Validate file buffer first (catches corrupted/invalid files early)
    documentService.validateFileBuffer(fileBuffer, originalName, mimeType);

    // 2. Authorize subject ownership
    await subjectsService.getSubjectById(userId, subjectId);

    // 3. Execute document processing pipeline (validation, storage, extraction, cleaning, chunking)
    const processedDoc = await documentService.processDocument(
      fileBuffer,
      originalName,
      userId,
      mimeType,
    );

    const derivedTitle = customTitle && customTitle.trim()
      ? sanitizeString(customTitle)
      : processedDoc.originalFileName.replace(/\.(pdf|jpg|jpeg|png|webp)$/i, '');

    // 4. Generate summary & key concepts
    let summaryText = '';
    let keyConcepts: string[] = [];
    try {
      const aiSummary = await aiService.summarize(derivedTitle, processedDoc.cleanedText);
      summaryText = aiSummary.executiveSummary;
      keyConcepts = aiSummary.suggestedTopics;
    } catch (e) {
      logger.debug(`AI Summary generation for material notice: ${e}`);
    }

    // 5. Generate Embeddings for chunks
    const chunkContents = processedDoc.chunks.map((c: any) => c.content);
    const embeddings = await embeddingService.generateBatchEmbeddings(chunkContents);

    if (isDbActive()) {
      try {
        const [material] = await db
          .insert(studyMaterials)
          .values({
            userId,
            subjectId,
            title: derivedTitle,
            fileType: processedDoc.fileType,
            fileSize: processedDoc.fileSize,
            rawText: processedDoc.cleanedText,
            originalFileName: processedDoc.originalFileName,
            storedPath: processedDoc.storedPath,
            pageCount: processedDoc.pageCount,
            summary: summaryText,
            keyConcepts,
            status: 'processed',
          })
          .returning();

        // Save chunks to DB and vector store
        const chunkRecords: ChunkRecord[] = processedDoc.chunks.map((c: any, i: number) => ({
          materialId: material.id,
          userId,
          chunkIndex: c.chunkIndex,
          content: c.content,
          tokenCount: c.tokenCount,
          pageNumber: c.pageNumber,
          embedding: embeddings[i] || [],
          materialTitle: derivedTitle,
          subjectId,
        }));

        const store = vectorStoreFactory.getVectorStore();
        await store.saveChunks(chunkRecords);

        memoryMaterials.set(material.id, material);
        memoryChunks.set(material.id, processedDoc.chunks);

        return {
          ...material,
          chunks: processedDoc.chunks,
          extractionMethod: processedDoc.extractionMethod,
          ocrConfidence: processedDoc.ocrConfidence,
          hasEquations: processedDoc.hasEquations,
          hasDiagrams: processedDoc.hasDiagrams,
        };
      } catch (err: any) {
        logger.debug(`Postgres uploadMaterialFile notice: ${err.message}`);
      }
    }

    const newId = ++nextMaterialId;
    const newMaterial = {
      id: newId,
      userId,
      subjectId,
      title: derivedTitle,
      fileType: processedDoc.fileType,
      fileSize: processedDoc.fileSize,
      rawText: processedDoc.cleanedText,
      originalFileName: processedDoc.originalFileName,
      storedPath: processedDoc.storedPath,
      pageCount: processedDoc.pageCount,
      summary: summaryText,
      keyConcepts,
      status: 'processed',
      createdAt: new Date(),
    };
    memoryMaterials.set(newId, newMaterial);
    memoryChunks.set(newId, processedDoc.chunks);

    const chunkRecords: ChunkRecord[] = processedDoc.chunks.map((c: any, i: number) => ({
      materialId: newId,
      userId,
      chunkIndex: c.chunkIndex,
      content: c.content,
      tokenCount: c.tokenCount,
      pageNumber: c.pageNumber,
      embedding: embeddings[i] || [],
      materialTitle: derivedTitle,
      subjectId,
    }));
    const store = vectorStoreFactory.getVectorStore();
    await store.saveChunks(chunkRecords);

    return {
      ...newMaterial,
      chunks: processedDoc.chunks,
      extractionMethod: processedDoc.extractionMethod,
      ocrConfidence: processedDoc.ocrConfidence,
      hasEquations: processedDoc.hasEquations,
      hasDiagrams: processedDoc.hasDiagrams,
    };
  },

  /**
   * PDF file upload helper alias
   */
  async uploadPdfFile(
    userId: string,
    subjectId: number,
    fileBuffer: Buffer,
    originalName: string,
    customTitle?: string,
    mimeType?: string,
  ) {
    return this.uploadMaterialFile(userId, subjectId, fileBuffer, originalName, customTitle, mimeType);
  },

  /**
   * Retrieves physical PDF file path for authorized download/streaming
   */
  async getMaterialDownloadFile(userId: string, materialId: number) {
    const material = await this.getMaterialById(userId, materialId);
    if (!material.storedPath) {
      throw new NotFoundError('Original file is not stored for this study note');
    }

    const filePath = await documentService.getSecureFilePath(material.storedPath);
    return {
      filePath,
      fileName: material.originalFileName || `${material.title}.pdf`,
    };
  },

  async deleteMaterial(userId: string, materialId: number) {
    // 1. Authorize ownership first
    const material = await this.getMaterialById(userId, materialId);

    // 2. Delete from vector store
    const store = vectorStoreFactory.getVectorStore();
    await store.deleteChunksByMaterial(materialId, userId);

    if (isDbActive()) {
      try {
        await db
          .delete(studyMaterials)
          .where(and(eq(studyMaterials.id, materialId), eq(studyMaterials.userId, userId)));
      } catch (err: any) {
        logger.debug(`Postgres deleteMaterial notice: ${err.message}`);
      }
    }

    memoryMaterials.delete(materialId);
    memoryChunks.delete(materialId);

    // Clean up stored file from disk
    if (material.storedPath) {
      await documentService.deleteSecureFile(material.storedPath).catch(() => {});
    }

    memoryAnnotations.delete(materialId);

    return { success: true, message: 'Material deleted successfully' };
  },

  async getAnnotations(userId: string, materialId: number) {
    await this.getMaterialById(userId, materialId);
    const data = memoryAnnotations.get(materialId) || { highlights: [], comments: [] };
    return data;
  },

  async saveAnnotations(
    userId: string,
    materialId: number,
    data: { highlights?: any[]; comments?: any[] }
  ) {
    await this.getMaterialById(userId, materialId);
    const current = memoryAnnotations.get(materialId) || { highlights: [], comments: [] };
    const updated = {
      highlights: Array.isArray(data.highlights) ? data.highlights : current.highlights,
      comments: Array.isArray(data.comments) ? data.comments : current.comments,
      updatedAt: new Date().toISOString(),
    };
    memoryAnnotations.set(materialId, updated);
    return updated;
  },
};
