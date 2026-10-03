import type { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.ts';
import { progressService } from '../services/progress.service.ts';
import { intelligenceService } from '../services/intelligence.service.ts';
import { sendSuccess } from '../utils/response.ts';

export const progressController = {
  async getProgress(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await progressService.getOverallProgress(req.user!.uid);
      sendSuccess(res, stats, 200);
    } catch (err) {
      next(err);
    }
  },

  async getSubjectProgress(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const list = await progressService.getSubjectProgress(req.user!.uid);
      sendSuccess(res, list, 200);
    } catch (err) {
      next(err);
    }
  },

  async getTopicProgress(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const subjectId = req.query.subjectId ? Number(req.query.subjectId) : undefined;
      const list = await progressService.getTopicProgress(req.user!.uid, subjectId);
      sendSuccess(res, list, 200);
    } catch (err) {
      next(err);
    }
  },

  async getIntelligence(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const subjectId = req.query.subjectId ? Number(req.query.subjectId) : undefined;
      const data = await intelligenceService.getStudyIntelligence(req.user!.uid, subjectId);
      sendSuccess(res, data, 200);
    } catch (err) {
      next(err);
    }
  },

  async getRecommendations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const subjectId = req.query.subjectId ? Number(req.query.subjectId) : undefined;
      const data = await intelligenceService.getStudyIntelligence(req.user!.uid, subjectId);
      sendSuccess(res, data.recommendations, 200);
    } catch (err) {
      next(err);
    }
  },

  async getAiCoaching(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const advice = await intelligenceService.generateAiCoachingAdvice(req.user!.uid);
      sendSuccess(res, advice, 200);
    } catch (err) {
      next(err);
    }
  },

  async recordSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { subjectId, activityType, durationMinutes, notes } = req.body;
      const session = await progressService.recordSession(req.user!.uid, {
        subjectId: subjectId ? Number(subjectId) : undefined,
        activityType: activityType || 'study',
        durationMinutes: Number(durationMinutes) || 1,
        notes,
      });
      sendSuccess(res, session, 201, 'Study session recorded');
    } catch (err) {
      next(err);
    }
  },
};
