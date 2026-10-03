import type { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.ts';
import { quizzesService } from '../services/quizzes.service.ts';
import { sendSuccess } from '../utils/response.ts';

export const quizzesController = {
  async generateQuiz(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { subjectId, materialId, count, difficulty } = req.body;
      const quiz = await quizzesService.generateQuiz(req.user!.uid, {
        subjectId: Number(subjectId),
        materialId: Number(materialId),
        count: count !== undefined ? Number(count) : undefined,
        difficulty,
      });
      sendSuccess(res, quiz, 201, 'Quiz generated successfully');
    } catch (err) {
      next(err);
    }
  },

  async getQuizzes(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const subjectId = req.query.subjectId ? Number(req.query.subjectId) : undefined;
      const list = await quizzesService.getQuizzes(req.user!.uid, subjectId);
      sendSuccess(res, list, 200);
    } catch (err) {
      next(err);
    }
  },

  async getQuizById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const quizId = Number(req.params.id);
      const includeAnswers = req.query.review === 'true';
      const quiz = await quizzesService.getQuizById(req.user!.uid, quizId, includeAnswers);
      sendSuccess(res, quiz, 200);
    } catch (err) {
      next(err);
    }
  },

  async submitQuiz(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const quizId = Number(req.params.id);
      const userSelections = req.body.userSelections || req.body.answers || [];
      const timeTakenSeconds = req.body.timeTakenSeconds ? Number(req.body.timeTakenSeconds) : 0;
      const result = await quizzesService.submitQuiz(
        req.user!.uid,
        quizId,
        userSelections,
        timeTakenSeconds,
      );
      sendSuccess(res, result, 200, 'Quiz evaluated successfully');
    } catch (err) {
      next(err);
    }
  },

  async deleteQuiz(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const quizId = Number(req.params.id);
      const result = await quizzesService.deleteQuiz(req.user!.uid, quizId);
      sendSuccess(res, result, 200, 'Quiz deleted successfully');
    } catch (err) {
      next(err);
    }
  },
};
