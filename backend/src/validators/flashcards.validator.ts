import { Request } from 'express';
import { validateRequest, isPositiveInteger } from './validation.util.ts';

export const validateFlashcardIdParam = validateRequest([
  (req: Request) => {
    if (!isPositiveInteger(req.params.id)) {
      return 'Flashcard ID must be a valid positive integer';
    }
    return null;
  },
]);

export const validateCreateFlashcard = validateRequest([
  (req: Request) => {
    const { subjectId } = req.body;
    if (!subjectId || !isPositiveInteger(subjectId)) {
      return 'Valid subjectId is required';
    }
    return null;
  },
  (req: Request) => {
    const { frontText } = req.body;
    if (!frontText || typeof frontText !== 'string' || !frontText.trim()) {
      return 'frontText is required';
    }
    return null;
  },
  (req: Request) => {
    const { backText } = req.body;
    if (!backText || typeof backText !== 'string' || !backText.trim()) {
      return 'backText is required';
    }
    return null;
  },
  (req: Request) => {
    const { difficultyLevel } = req.body;
    if (difficultyLevel !== undefined && !['easy', 'medium', 'hard'].includes(difficultyLevel)) {
      return 'difficultyLevel must be one of: easy, medium, hard';
    }
    return null;
  },
]);

export const validateUpdateFlashcard = validateRequest([
  (req: Request) => {
    if (!isPositiveInteger(req.params.id)) {
      return 'Flashcard ID must be a valid positive integer';
    }
    return null;
  },
  (req: Request) => {
    const { frontText, backText, repetitionBox, status, difficultyLevel } = req.body;
    if (frontText !== undefined && (typeof frontText !== 'string' || !frontText.trim())) {
      return 'frontText cannot be empty';
    }
    if (backText !== undefined && (typeof backText !== 'string' || !backText.trim())) {
      return 'backText cannot be empty';
    }
    if (status !== undefined && !['new', 'learning', 'needs_revision', 'known', 'mastered'].includes(status)) {
      return 'status must be one of: new, learning, needs_revision, known, mastered';
    }
    if (difficultyLevel !== undefined && !['easy', 'medium', 'hard'].includes(difficultyLevel)) {
      return 'difficultyLevel must be one of: easy, medium, hard';
    }
    if (repetitionBox !== undefined) {
      const box = Number(repetitionBox);
      if (!Number.isInteger(box) || box < 1 || box > 5) {
        return 'repetitionBox must be an integer between 1 and 5';
      }
    }
    return null;
  },
]);

export const validateReviewFlashcard = validateRequest([
  (req: Request) => {
    if (!isPositiveInteger(req.params.id)) {
      return 'Flashcard ID must be a valid positive integer';
    }
    return null;
  },
  (req: Request) => {
    const { outcome, isKnown } = req.body;
    const allowedOutcomes = ['known', 'needs_revision', 'again', 'hard', 'good', 'easy'];
    if (outcome !== undefined && !allowedOutcomes.includes(outcome)) {
      return `outcome must be one of: ${allowedOutcomes.join(', ')}`;
    }
    if (outcome === undefined && isKnown === undefined) {
      return 'Either outcome or isKnown boolean is required';
    }
    return null;
  },
]);
