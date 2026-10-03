import { Request } from 'express';
import { validateRequest } from './validation.util.ts';

export const validateAiSummarize = validateRequest([
  (req: Request) => {
    const { content, materialId } = req.body;
    if (!content && !materialId) {
      return 'Either "content" (string) or "materialId" (number) is required';
    }
    return null;
  },
]);

export const validateAiExplain = validateRequest([
  (req: Request) => {
    const { topic } = req.body;
    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      return 'Topic is required';
    }
    return null;
  },
]);

export const validateAiChat = validateRequest([
  (req: Request) => {
    const { question } = req.body;
    if (!question || typeof question !== 'string' || !question.trim()) {
      return 'Question is required';
    }
    return null;
  },
]);

export const validateAiGenerateQuiz = validateRequest([
  (req: Request) => {
    const { content, materialId, title } = req.body;
    if (!content && !materialId && !title) {
      return 'Either "content", "title", or "materialId" is required';
    }
    return null;
  },
]);

export const validateAiGenerateFlashcards = validateRequest([
  (req: Request) => {
    const { content, materialId, title } = req.body;
    if (!content && !materialId && !title) {
      return 'Either "content", "title", or "materialId" is required';
    }
    return null;
  },
]);
