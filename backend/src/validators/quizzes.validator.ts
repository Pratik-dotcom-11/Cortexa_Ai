import { Request } from 'express';
import { validateRequest, isPositiveInteger } from './validation.util.ts';

export const validateQuizIdParam = validateRequest([
  (req: Request) => {
    if (!isPositiveInteger(req.params.id)) {
      return 'Quiz ID must be a valid positive integer';
    }
    return null;
  },
]);

export const validateGenerateQuiz = validateRequest([
  (req: Request) => {
    const { subjectId } = req.body;
    if (!subjectId || !isPositiveInteger(subjectId)) {
      return 'Valid subjectId is required';
    }
    return null;
  },
  (req: Request) => {
    const { materialId } = req.body;
    if (!materialId || !isPositiveInteger(materialId)) {
      return 'Valid materialId is required';
    }
    return null;
  },
  (req: Request) => {
    const { count } = req.body;
    if (count !== undefined) {
      const num = Number(count);
      if (!Number.isInteger(num) || num < 1 || num > 20) {
        return 'Question count must be an integer between 1 and 20';
      }
    }
    return null;
  },
  (req: Request) => {
    const { difficulty } = req.body;
    if (difficulty !== undefined && !['easy', 'medium', 'hard'].includes(difficulty)) {
      return 'Difficulty must be easy, medium, or hard';
    }
    return null;
  },
]);

export const validateSubmitQuiz = validateRequest([
  (req: Request) => {
    if (!isPositiveInteger(req.params.id)) {
      return 'Quiz ID must be a valid positive integer';
    }
    return null;
  },
  (req: Request) => {
    const { userSelections } = req.body;
    if (!Array.isArray(userSelections)) {
      return 'userSelections must be an array';
    }
    for (const sel of userSelections) {
      if (!sel || typeof sel !== 'object') {
        return 'Each element in userSelections must be an object with questionId and selectedIndex';
      }
      if (!isPositiveInteger(sel.questionId)) {
        return 'Invalid questionId in userSelections';
      }
      if (typeof sel.selectedIndex !== 'number' || sel.selectedIndex < -1 || sel.selectedIndex > 10) {
        return 'Invalid selectedIndex in userSelections';
      }
    }
    return null;
  },
]);
