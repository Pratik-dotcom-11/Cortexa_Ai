import type { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.ts';
import { subjectsService } from '../services/subjects.service.ts';
import { sendSuccess } from '../utils/response.ts';

export const subjectsController = {
  async getSubjects(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const list = await subjectsService.getSubjects(req.user!.uid);
      sendSuccess(res, list, 200);
    } catch (err) {
      next(err);
    }
  },

  async getSubjectById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const subjectId = Number(req.params.id);
      const subject = await subjectsService.getSubjectById(req.user!.uid, subjectId);
      sendSuccess(res, subject, 200);
    } catch (err) {
      next(err);
    }
  },

  async createSubject(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, code, color, description } = req.body;
      const created = await subjectsService.createSubject(req.user!.uid, {
        name,
        code,
        color,
        description,
      });
      sendSuccess(res, created, 201, 'Subject created successfully');
    } catch (err) {
      next(err);
    }
  },

  async updateSubject(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const subjectId = Number(req.params.id);
      const { name, code, color, description } = req.body;
      const updated = await subjectsService.updateSubject(req.user!.uid, subjectId, {
        name,
        code,
        color,
        description,
      });
      sendSuccess(res, updated, 200, 'Subject updated successfully');
    } catch (err) {
      next(err);
    }
  },

  async deleteSubject(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const subjectId = Number(req.params.id);
      const result = await subjectsService.deleteSubject(req.user!.uid, subjectId);
      sendSuccess(res, result, 200, 'Subject deleted successfully');
    } catch (err) {
      next(err);
    }
  },
};
