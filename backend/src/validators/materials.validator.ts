import { Request } from 'express';
import { validateRequest, isPositiveInteger } from './validation.util.ts';

export const validateMaterialIdParam = validateRequest([
  (req: Request) => {
    if (!isPositiveInteger(req.params.id)) {
      return 'Material ID must be a valid positive integer';
    }
    return null;
  },
]);

export const validateCreateMaterial = validateRequest([
  (req: Request) => {
    const { subjectId } = req.body;
    if (!subjectId || !isPositiveInteger(subjectId)) {
      return 'Valid subjectId is required';
    }
    return null;
  },
  (req: Request) => {
    const { title } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return 'Material title is required';
    }
    if (title.trim().length > 255) {
      return 'Material title cannot exceed 255 characters';
    }
    return null;
  },
  (req: Request) => {
    const { rawText } = req.body;
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return 'Material content (rawText) is required';
    }
    return null;
  },
  (req: Request) => {
    const { fileType } = req.body;
    if (fileType !== undefined && !['pdf', 'image', 'note', 'notes', 'handwritten_notes', 'text', 'doc', 'slides'].includes(fileType)) {
      return 'fileType must be one of pdf, image, note, notes, handwritten_notes, text, doc, slides';
    }
    return null;
  },
]);
