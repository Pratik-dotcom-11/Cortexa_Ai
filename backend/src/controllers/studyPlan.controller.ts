import type { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.ts';
import { studyPlanService } from '../services/studyPlan.service.ts';
import { sendSuccess } from '../utils/response.ts';

export const studyPlanController = {
  async getStudyPlans(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const subjectId = req.query.subjectId ? Number(req.query.subjectId) : undefined;
      const plans = await studyPlanService.getStudyPlans(req.user!.uid, subjectId);
      sendSuccess(res, plans, 200);
    } catch (err) {
      next(err);
    }
  },

  async createStudyPlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { subjectId, title, targetDate, dailyGoals } = req.body;
      const created = await studyPlanService.createStudyPlan(req.user!.uid, {
        subjectId: Number(subjectId),
        title,
        targetDate,
        dailyGoals,
      });
      sendSuccess(res, created, 201, 'Study plan created successfully');
    } catch (err) {
      next(err);
    }
  },

  async getStudyPlanById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const planId = Number(req.params.id);
      const plan = await studyPlanService.getStudyPlanById(req.user!.uid, planId);
      sendSuccess(res, plan, 200);
    } catch (err) {
      next(err);
    }
  },

  async updateStudyPlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const planId = Number(req.params.id);
      const { title, targetDate, dailyGoals, isActive } = req.body;
      const updated = await studyPlanService.updateStudyPlan(req.user!.uid, planId, {
        title,
        targetDate,
        dailyGoals,
        isActive,
      });
      sendSuccess(res, updated, 200, 'Study plan updated successfully');
    } catch (err) {
      next(err);
    }
  },

  async deleteStudyPlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const planId = Number(req.params.id);
      const result = await studyPlanService.deleteStudyPlan(req.user!.uid, planId);
      sendSuccess(res, result, 200, 'Study plan deleted successfully');
    } catch (err) {
      next(err);
    }
  },
};
