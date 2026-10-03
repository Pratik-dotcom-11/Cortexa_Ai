import type { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.ts';
import { conversationsService } from '../services/conversations.service.ts';
import { sendSuccess } from '../utils/response.ts';

export const conversationsController = {
  async getConversations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const list = await conversationsService.getConversations(req.user!.uid);
      sendSuccess(res, list, 200);
    } catch (err) {
      next(err);
    }
  },

  async getConversationById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const conv = await conversationsService.getConversationById(req.user!.uid, Number(req.params.id));
      sendSuccess(res, conv, 200);
    } catch (err) {
      next(err);
    }
  },

  async createConversation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { title, subjectId, materialId, mode } = req.body;
      const created = await conversationsService.createConversation(req.user!.uid, {
        title,
        subjectId: subjectId ? Number(subjectId) : undefined,
        materialId: materialId ? Number(materialId) : undefined,
        mode: mode || 'auto',
      });
      sendSuccess(res, created, 201, 'Conversation started successfully');
    } catch (err) {
      next(err);
    }
  },

  async sendMessage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { content, mode, materialId, subjectId } = req.body;
      const result = await conversationsService.sendMessage(
        req.user!.uid,
        Number(req.params.id),
        {
          content,
          mode,
          materialId: materialId ? Number(materialId) : undefined,
          subjectId: subjectId ? Number(subjectId) : undefined,
        },
      );
      sendSuccess(res, result, 200, 'Message processed successfully');
    } catch (err) {
      next(err);
    }
  },

  async updateConversation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { title, subjectId, materialId, mode } = req.body;
      const updated = await conversationsService.updateConversation(
        req.user!.uid,
        Number(req.params.id),
        {
          title,
          mode,
          subjectId: subjectId === null ? null : subjectId ? Number(subjectId) : undefined,
          materialId: materialId === null ? null : materialId ? Number(materialId) : undefined,
        },
      );
      sendSuccess(res, updated, 200, 'Conversation updated successfully');
    } catch (err) {
      next(err);
    }
  },

  async deleteConversation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await conversationsService.deleteConversation(
        req.user!.uid,
        Number(req.params.id),
      );
      sendSuccess(res, result, 200, 'Conversation deleted successfully');
    } catch (err) {
      next(err);
    }
  },
};
