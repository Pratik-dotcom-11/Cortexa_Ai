import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PDFParse } from 'pdf-parse';
import { BadRequestError } from '../utils/errors.ts';
import { logger } from '../utils/logger.ts';
import { aiService } from '../ai/ai.service.ts';

export interface DocumentChunk {
  chunkIndex: number;
  content: string;
  tokenCount: number;
  wordCount: number;
  pageNumber: number;
}

export interface ProcessedDocument {
  originalFileName: string;
  storedFileName: string;
  storedPath: string;
  fileSize: number;
  fileType: string;
  pageCount: number;
  totalWords: number;
  totalChars: number;
  cleanedText: string;
  chunks: DocumentChunk[];
  extractionMethod?: 'pdf_text' | 'gemini_vision_ocr' | 'hybrid';
  ocrConfidence?: 'high' | 'medium' | 'low' | 'unclear';
  hasEquations?: boolean;
  hasDiagrams?: boolean;
}

// Maximum allowed upload size: 15MB
export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;
export const MIN_FILE_SIZE_BYTES = 50;

// Base storage directory for uploaded materials
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads', 'materials');

// Ensure upload directory exists
const ensureUploadDir = async (): Promise<string> => {
  await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
  return UPLOADS_DIR;
};

export const documentService = {
  /**
   * Sanitizes original filename:
   * - Strips path traversal (../, ..\\)
   * - Strips dangerous characters
   * - Limits length to 150 characters
   */
  sanitizeFileName(fileName?: string, defaultExt: string = '.pdf'): string {
    if (!fileName || typeof fileName !== 'string') {
      return `document${defaultExt}`;
    }
    const base = path.basename(fileName.trim());
    const sanitized = base
      .replace(/[^a-zA-Z0-9._\- ]/g, '_')
      .replace(/\.{2,}/g, '.')
      .slice(0, 150);
    return sanitized || `document${defaultExt}`;
  },

  /**
   * Detects MIME type and file category from magic bytes and filename
   */
  detectFileType(buffer: Buffer, originalName?: string, mimeType?: string): {
    category: 'pdf' | 'image' | 'unsupported';
    mime: string;
    ext: string;
  } {
    if (!buffer || buffer.length < 4) {
      return { category: 'unsupported', mime: 'application/octet-stream', ext: '.bin' };
    }

    // 1. PDF: first 5 bytes = %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D)
    if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
      return { category: 'pdf', mime: 'application/pdf', ext: '.pdf' };
    }

    // 2. PNG: \x89PNG\r\n\x1a\n (0x89, 0x50, 0x4E, 0x47)
    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return { category: 'image', mime: 'image/png', ext: '.png' };
    }

    // 3. JPEG: 0xFF, 0xD8, 0xFF
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { category: 'image', mime: 'image/jpeg', ext: '.jpg' };
    }

    // 4. WEBP: 'RIFF' at 0..3 and 'WEBP' at 8..11
    if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return { category: 'image', mime: 'image/webp', ext: '.webp' };
    }

    // Check extension fallback if magic byte was slightly offset
    const lowerName = (originalName || '').toLowerCase();
    if (lowerName.endsWith('.pdf')) {
      return { category: 'pdf', mime: 'application/pdf', ext: '.pdf' };
    }
    if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
      return { category: 'image', mime: 'image/jpeg', ext: '.jpg' };
    }
    if (lowerName.endsWith('.png')) {
      return { category: 'image', mime: 'image/png', ext: '.png' };
    }
    if (lowerName.endsWith('.webp')) {
      return { category: 'image', mime: 'image/webp', ext: '.webp' };
    }

    if (mimeType === 'application/pdf' || mimeType === 'application/x-pdf') {
      return { category: 'pdf', mime: 'application/pdf', ext: '.pdf' };
    }
    if (mimeType?.startsWith('image/')) {
      return { category: 'image', mime: mimeType, ext: '.jpg' };
    }

    return { category: 'unsupported', mime: mimeType || 'application/octet-stream', ext: '.bin' };
  },

  /**
   * Validates file size, mime type, and magic bytes signature
   */
  validateFileBuffer(
    buffer: Buffer,
    originalName?: string,
    mimeType?: string,
  ): { category: 'pdf' | 'image'; mime: string; ext: string } {
    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw new BadRequestError('Upload failed: Empty or invalid file payload');
    }

    if (buffer.length < MIN_FILE_SIZE_BYTES) {
      throw new BadRequestError('Upload failed: File is empty or corrupted (under minimum file size)');
    }

    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestError(
        `Upload failed: File size (${(buffer.length / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit of 15MB`,
      );
    }

    const detected = this.detectFileType(buffer, originalName, mimeType);
    if (detected.category === 'unsupported') {
      throw new BadRequestError(
        'Upload failed: Unsupported file format. Please upload a PDF document (.pdf) or image of study notes (.jpg, .jpeg, .png, .webp).',
      );
    }

    // Verify PDF magic bytes specifically if filename claims to be PDF
    if (detected.category === 'pdf') {
      const magic = buffer.subarray(0, 5).toString('ascii');
      if (magic !== '%PDF-') {
        throw new BadRequestError(
          'Upload failed: Invalid PDF structure or file is not a valid PDF document (magic byte signature mismatch)',
        );
      }
    }

    return detected as { category: 'pdf' | 'image'; mime: string; ext: string };
  },

  /**
   * Backward-compatible PDF buffer validation
   */
  validatePdfBuffer(buffer: Buffer, originalName?: string, mimeType?: string): void {
    if (originalName && !originalName.toLowerCase().endsWith('.pdf')) {
      throw new BadRequestError('Upload failed: File must have a .pdf extension');
    }
    this.validateFileBuffer(buffer, originalName, mimeType || 'application/pdf');
  },

  /**
   * Cleans extracted text:
   * - Normalizes unicode (NFKC)
   * - Strips non-printable ASCII control characters except \n and \t
   * - Removes pagination header/footer noise
   * - Collapses redundant whitespace and excessive blank lines
   */
  cleanExtractedText(rawText: string): string {
    if (!rawText) return '';

    let text = rawText.normalize('NFKC');

    // Standardize line endings
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Strip ASCII control characters (keeping \t = 9 and \n = 10)
    text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Strip common PDF page markers generated by parsers (e.g. "-- 1 of 12 --")
    text = text.replace(/--\s*\d+\s+of\s+\d+\s*--/gi, '');

    // Strip standalone "Page X of Y" or "Page X" lines
    text = text.replace(/^[ \t]*Page\s+\d+(\s+of\s+\d+)?[ \t]*$/gim, '');

    // Collapse multiple horizontal spaces to single space
    text = text.replace(/[ \t]+/g, ' ');

    // Collapse 3 or more newlines to double newline (preserving paragraphs)
    text = text.replace(/\n{3,}/g, '\n\n');

    return text.trim();
  },

  /**
   * Splits cleaned text into semantic chunks:
   * - Respects paragraph and sentence boundaries
   * - Maintains context overlap across chunks
   * - Computes token and word counts
   */
  splitIntoChunks(
    cleanedText: string,
    chunkSizeChars: number = 1000,
    overlapChars: number = 150,
    defaultPage: number = 1,
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    if (!cleanedText || cleanedText.length === 0) {
      return chunks;
    }

    if (cleanedText.length <= chunkSizeChars) {
      const words = cleanedText.split(/\s+/).filter(Boolean).length;
      return [
        {
          chunkIndex: 0,
          content: cleanedText,
          tokenCount: Math.ceil(cleanedText.length / 4),
          wordCount: words,
          pageNumber: defaultPage,
        },
      ];
    }

    let startIndex = 0;
    let chunkIndex = 0;

    while (startIndex < cleanedText.length) {
      let targetEnd = Math.min(startIndex + chunkSizeChars, cleanedText.length);

      if (targetEnd < cleanedText.length) {
        const paragraphBoundary = cleanedText.lastIndexOf('\n\n', targetEnd);
        if (paragraphBoundary > startIndex + chunkSizeChars * 0.5) {
          targetEnd = paragraphBoundary;
        } else {
          const sentenceMatch = cleanedText.slice(startIndex, targetEnd).match(/([.!?]\s+)[^.!?]*$/);
          if (sentenceMatch && sentenceMatch.index && sentenceMatch.index > chunkSizeChars * 0.5) {
            targetEnd = startIndex + sentenceMatch.index + sentenceMatch[1].length;
          } else {
            const spaceBoundary = cleanedText.lastIndexOf(' ', targetEnd);
            if (spaceBoundary > startIndex + chunkSizeChars * 0.6) {
              targetEnd = spaceBoundary;
            }
          }
        }
      }

      const chunkSlice = cleanedText.slice(startIndex, targetEnd).trim();
      if (chunkSlice.length > 0) {
        const words = chunkSlice.split(/\s+/).filter(Boolean).length;
        chunks.push({
          chunkIndex,
          content: chunkSlice,
          tokenCount: Math.ceil(chunkSlice.length / 4),
          wordCount: words,
          pageNumber: defaultPage === 1 ? Math.floor(startIndex / 2500) + 1 : defaultPage,
        });
        chunkIndex++;
      }

      if (targetEnd >= cleanedText.length) {
        break;
      }

      startIndex = Math.max(targetEnd - overlapChars, startIndex + 1);
    }

    return chunks;
  },

  /**
   * Splits multi-page OCR transcription into page-preserved semantic chunks
   */
  splitPagesIntoChunks(
    pages: Array<{ pageNumber: number; transcription: string }>,
    chunkSizeChars: number = 1000,
    overlapChars: number = 150,
  ): DocumentChunk[] {
    const allChunks: DocumentChunk[] = [];
    let globalIndex = 0;

    for (const page of pages) {
      const pageText = this.cleanExtractedText(page.transcription);
      if (!pageText) continue;

      const pageChunks = this.splitIntoChunks(pageText, chunkSizeChars, overlapChars, page.pageNumber);
      for (const pc of pageChunks) {
        allChunks.push({
          chunkIndex: globalIndex++,
          content: pc.content,
          tokenCount: pc.tokenCount,
          wordCount: pc.wordCount,
          pageNumber: page.pageNumber,
        });
      }
    }

    return allChunks;
  },

  /**
   * Securely saves the uploaded file to disk using an unguessable UUID.
   */
  async saveFileSecurely(
    buffer: Buffer,
    userId: string,
    ext: string = '.pdf',
  ): Promise<{ storedFileName: string; storedPath: string }> {
    const uploadDir = await ensureUploadDir();
    const safeUid = userId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'user';
    const uniqueId = crypto.randomUUID();
    const storedFileName = `doc_${safeUid}_${uniqueId}${ext}`;
    const storedPath = path.join(uploadDir, storedFileName);

    await fs.promises.writeFile(storedPath, buffer, { mode: 0o600 });

    return {
      storedFileName,
      storedPath,
    };
  },

  /**
   * Unified Study Material Processing Pipeline:
   * Handles:
   * 1. Machine-readable typed PDFs
   * 2. Scanned / handwritten PDFs (via Gemini Multimodal Vision OCR fallback)
   * 3. Handwritten notes photos & study images (JPG, PNG, WEBP)
   * 4. Mixed handwritten + typed documents
   * 5. Complex mathematical equations, LaTeX, formulas, and diagrams
   */
  async processDocument(
    buffer: Buffer,
    originalName: string,
    userId: string,
    mimeType?: string,
  ): Promise<ProcessedDocument> {
    // 1. Validate file payload, size, and magic bytes
    const detected = this.validateFileBuffer(buffer, originalName, mimeType);
    const sanitizedName = this.sanitizeFileName(originalName, detected.ext);

    // 2. Securely store raw file
    const { storedFileName, storedPath } = await this.saveFileSecurely(
      buffer,
      userId,
      detected.ext,
    );

    let cleanedText = '';
    let pageCount = 1;
    let extractionMethod: 'pdf_text' | 'gemini_vision_ocr' | 'hybrid' = 'pdf_text';
    let chunks: DocumentChunk[] = [];
    let ocrConfidence: 'high' | 'medium' | 'low' | 'unclear' = 'high';
    let hasEquations = false;
    let hasDiagrams = false;

    if (detected.category === 'pdf') {
      // 3a. First attempt fast digital PDF text extraction
      let rawDigitalText = '';
      let parser: PDFParse | null = null;
      let pdfParseFailed = false;

      try {
        parser = new PDFParse({ data: buffer });
        const textResult = await parser.getText();
        rawDigitalText = textResult?.text || '';
        pageCount = textResult?.total || 1;
      } catch (parseError: any) {
        logger.warn(`PDF digital text extraction skipped (${parseError.message}), initiating vision OCR.`);
        pdfParseFailed = true;
      } finally {
        if (parser) {
          await parser.destroy().catch(() => {});
        }
      }

      const candidateCleanedText = this.cleanExtractedText(rawDigitalText);
      const meaningfulDigitalChars = candidateCleanedText.replace(/[^a-zA-Z0-9]/g, '');

      // If PDF has rich readable machine text (>= 40 characters and not corrupted)
      if (!pdfParseFailed && meaningfulDigitalChars.length >= 40) {
        cleanedText = candidateCleanedText;
        extractionMethod = 'pdf_text';
        chunks = this.splitIntoChunks(cleanedText);
        ocrConfidence = 'high';
      } else {
        // 3b. Scanned / Handwritten PDF -> Multimodal Vision OCR Pipeline
        logger.info(`Activating Gemini Multimodal Vision OCR for scanned/handwritten PDF: ${sanitizedName}`);
        extractionMethod = 'gemini_vision_ocr';

        let ocrResult = await aiService.ocrDocument(buffer, 'application/pdf');

        // Retry with stronger prompt if first pass was unclear
        if (!ocrResult.isMeaningful || ocrResult.confidence === 'unclear') {
          logger.info(`Retrying Gemini OCR with enhanced contrast instructions for ${sanitizedName}`);
          ocrResult = await aiService.ocrDocument(buffer, 'application/pdf', { retryStronger: true });
        }

        if (!ocrResult.isMeaningful || ocrResult.fullText.trim().length === 0) {
          // Clean up saved file if document has zero extractable content
          await this.deleteSecureFile(storedPath).catch(() => {});
          throw new BadRequestError(
            'Upload failed: No readable text or handwriting could be extracted from this PDF. It may be empty or contain unreadable content. Try uploading a clearer image or document.',
          );
        }

        cleanedText = this.cleanExtractedText(ocrResult.fullText);
        ocrConfidence = ocrResult.confidence;
        hasEquations = ocrResult.hasEquations;
        hasDiagrams = ocrResult.hasDiagrams;
        pageCount = ocrResult.pages.length > 0 ? ocrResult.pages.length : pageCount;

        if (ocrResult.pages.length > 0) {
          chunks = this.splitPagesIntoChunks(ocrResult.pages);
        } else {
          chunks = this.splitIntoChunks(cleanedText);
        }
      }
    } else {
      // 3c. Direct Image Upload (JPG, PNG, WEBP) -> Multimodal Vision OCR Pipeline
      logger.info(`Activating Gemini Multimodal Vision OCR for educational image note: ${sanitizedName}`);
      extractionMethod = 'gemini_vision_ocr';

      let ocrResult = await aiService.ocrDocument(buffer, detected.mime);

      if (!ocrResult.isMeaningful || ocrResult.confidence === 'unclear') {
        logger.info(`Retrying OCR with enhanced stroke boundary instructions for image ${sanitizedName}`);
        ocrResult = await aiService.ocrDocument(buffer, detected.mime, { retryStronger: true });
      }

      if (!ocrResult.isMeaningful || ocrResult.fullText.trim().length === 0) {
        await this.deleteSecureFile(storedPath).catch(() => {});
        throw new BadRequestError(
          'Upload failed: We couldn\'t read enough text from this page. Try uploading a clearer image with better lighting and less blur.',
        );
      }

      cleanedText = this.cleanExtractedText(ocrResult.fullText);
      ocrConfidence = ocrResult.confidence;
      hasEquations = ocrResult.hasEquations;
      hasDiagrams = ocrResult.hasDiagrams;
      pageCount = 1;

      chunks = this.splitIntoChunks(cleanedText, 1000, 150, 1);
    }

    const totalWords = cleanedText.split(/\s+/).filter(Boolean).length;

    return {
      originalFileName: sanitizedName,
      storedFileName,
      storedPath,
      fileSize: buffer.length,
      fileType: detected.category === 'image' ? 'image' : 'pdf',
      pageCount,
      totalWords,
      totalChars: cleanedText.length,
      cleanedText,
      chunks,
      extractionMethod,
      ocrConfidence,
      hasEquations,
      hasDiagrams,
    };
  },

  /**
   * Backward-compatible PDF processor
   */
  async processPdf(
    buffer: Buffer,
    originalName: string,
    userId: string,
    mimeType?: string,
  ): Promise<ProcessedDocument> {
    return this.processDocument(buffer, originalName, userId, mimeType || 'application/pdf');
  },

  /**
   * Safely verifies file path exists for authorized download / streaming
   */
  async getSecureFilePath(storedPath?: string | null): Promise<string> {
    if (!storedPath || typeof storedPath !== 'string') {
      throw new BadRequestError('File storage reference is missing');
    }

    const resolved = path.resolve(storedPath);
    const uploadDir = path.resolve(UPLOADS_DIR);

    if (!resolved.startsWith(uploadDir)) {
      throw new BadRequestError('Access denied: Invalid file path');
    }

    try {
      await fs.promises.access(resolved, fs.constants.R_OK);
      return resolved;
    } catch {
      throw new BadRequestError('Stored file is no longer available on server');
    }
  },

  /**
   * Safely deletes file from disk
   */
  async deleteSecureFile(storedPath?: string | null): Promise<void> {
    if (!storedPath) return;
    try {
      const resolved = path.resolve(storedPath);
      const uploadDir = path.resolve(UPLOADS_DIR);
      if (resolved.startsWith(uploadDir)) {
        await fs.promises.unlink(resolved);
      }
    } catch (e: any) {
      logger.warn(`Could not delete file at ${storedPath}: ${e.message}`);
    }
  },
};
