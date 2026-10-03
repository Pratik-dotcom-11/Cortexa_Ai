import { Request } from 'express';
import { validateRequest, isPositiveInteger } from './validation.util.ts';

const VALID_MODES = [
  'auto',
  'study',
  'coding',
  'explain',
  'solve',
  'writing',
  'brainstorm',
  'general',
];

export const validateCreateConversation = validateRequest([
  (req: Request) => {
    const { title } = req.body;
    if (title !== undefined && (typeof title !== 'string' || title.length > 200)) {
      return 'title must be a string up to 200 characters';
    }
    return null;
  },
  (req: Request) => {
    const { mode } = req.body;
    if (mode !== undefined && !VALID_MODES.includes(mode)) {
      return `mode must be one of: ${VALID_MODES.join(', ')}`;
    }
    return null;
  },
  (req: Request) => {
    const { subjectId } = req.body;
    if (subjectId !== undefined && !isPositiveInteger(subjectId)) {
      return 'subjectId must be a positive integer';
    }
    return null;
  },
  (req: Request) => {
    const { materialId } = req.body;
    if (materialId !== undefined && !isPositiveInteger(materialId)) {
      return 'materialId must be a positive integer';
    }
    return null;
  },
]);

export const validateSendMessage = validateRequest([
  (req: Request) => {
    const { content } = req.body;
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return 'content is required and must be a non-empty string';
    }
    if (content.length > 10000) {
      return 'content cannot exceed 10000 characters';
    }
    return null;
  },
  (req: Request) => {
    const { mode } = req.body;
    if (mode !== undefined && !VALID_MODES.includes(mode)) {
      return `mode must be one of: ${VALID_MODES.join(', ')}`;
    }
    return null;
  },
]);

export const validateConversationId = validateRequest([
  (req: Request) => {
    if (!isPositiveInteger(req.params.id)) {
      return 'Invalid conversation ID parameter';
    }
    return null;
  },
]);
