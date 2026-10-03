import type { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.ts';
import { flashcardsService } from '../services/flashcards.service.ts';
import { sendSuccess } from '../utils/response.ts';

export const flashcardsController = {
  async getFlashcards(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const subjectId = req.query.subjectId ? Number(req.query.subjectId) : undefined;
      const materialId = req.query.materialId ? Number(req.query.materialId) : undefined;
      const difficultyLevel = req.query.difficultyLevel ? String(req.query.difficultyLevel) : undefined;
      const status = req.query.status ? String(req.query.status) : undefined;
      const topicTag = req.query.topicTag ? String(req.query.topicTag) : undefined;

      const list = await flashcardsService.getFlashcards(req.user!.uid, {
        subjectId,
        materialId,
        difficultyLevel,
        status,
        topicTag,
      });
      sendSuccess(res, list, 200);
    } catch (err) {
      next(err);
    }
  },

  async getFlashcardById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const cardId = Number(req.params.id);
      const card = await flashcardsService.getFlashcardById(req.user!.uid, cardId);
      sendSuccess(res, card, 200);
    } catch (err) {
      next(err);
    }
  },

  async getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const subjectId = req.query.subjectId ? Number(req.query.subjectId) : undefined;
      const stats = await flashcardsService.getFlashcardStats(req.user!.uid, subjectId);
      sendSuccess(res, stats, 200);
    } catch (err) {
      next(err);
    }
  },

  async createFlashcard(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        subjectId,
        materialId,
        frontText,
        backText,
        topicTag,
        difficultyLevel,
        status,
      } = req.body;
      const created = await flashcardsService.createFlashcard(req.user!.uid, {
        subjectId: Number(subjectId),
        materialId: materialId ? Number(materialId) : undefined,
        frontText,
        backText,
        topicTag,
        difficultyLevel,
        status,
      });
      sendSuccess(res, created, 201, 'Flashcard created successfully');
    } catch (err) {
      next(err);
    }
  },

  async updateFlashcard(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const cardId = Number(req.params.id);
      const {
        frontText,
        backText,
        topicTag,
        difficultyLevel,
        status,
        repetitionBox,
      } = req.body;
      const updated = await flashcardsService.updateFlashcard(req.user!.uid, cardId, {
        frontText,
        backText,
        topicTag,
        difficultyLevel,
        status,
        repetitionBox: repetitionBox !== undefined ? Number(repetitionBox) : undefined,
      });
      sendSuccess(res, updated, 200, 'Flashcard updated successfully');
    } catch (err) {
      next(err);
    }
  },

  async reviewFlashcard(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const cardId = Number(req.params.id);
      const { outcome, isKnown } = req.body;
      const result = await flashcardsService.reviewFlashcard(req.user!.uid, cardId, {
        outcome,
        isKnown,
      });
      sendSuccess(res, result, 200, 'Flashcard review recorded successfully');
    } catch (err) {
      next(err);
    }
  },

  async deleteFlashcard(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const cardId = Number(req.params.id);
      const result = await flashcardsService.deleteFlashcard(req.user!.uid, cardId);
      sendSuccess(res, result, 200, 'Flashcard deleted successfully');
    } catch (err) {
      next(err);
    }
  },

  async deleteBulk(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cardIds, subjectId, materialId } = req.body;
      const result = await flashcardsService.deleteFlashcardsBulk(req.user!.uid, {
        cardIds: Array.isArray(cardIds) ? cardIds.map(Number) : undefined,
        subjectId: subjectId ? Number(subjectId) : undefined,
        materialId: materialId ? Number(materialId) : undefined,
      });
      sendSuccess(res, result, 200, 'Flashcards bulk deleted successfully');
    } catch (err) {
      next(err);
    }
  },

  async generateFlashcards(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { subjectId, materialId, count, topicFocus } = req.body;
      const created = await flashcardsService.generateFlashcards(req.user!.uid, {
        subjectId: Number(subjectId),
        materialId: materialId ? Number(materialId) : undefined,
        count: count ? Number(count) : 8,
        topicFocus,
      });
      sendSuccess(res, created, 201, 'Flashcards generated and saved successfully');
    } catch (err) {
      next(err);
    }
  },
};
