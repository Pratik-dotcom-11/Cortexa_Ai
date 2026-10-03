import type { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service.ts';
import { AuthRequest } from '../middleware/auth.middleware.ts';
import { sendSuccess } from '../utils/response.ts';

export const authController = {
  async signup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, displayName, university, major } = req.body;
      const result = await authService.signup({
        email,
        password,
        displayName,
        university,
        major,
      });
      sendSuccess(res, result, 201, 'Account created successfully');
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      const result = await authService.login({ email, password });
      sendSuccess(res, result, 200, 'Login successful');
    } catch (err) {
      next(err);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
      const result = await authService.logout(token);
      sendSuccess(res, result, 200, 'Logout successful');
    } catch (err) {
      next(err);
    }
  },

  async demo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const role = String(req.body.role || 'cs');
      const result = await authService.demoLogin(role);
      sendSuccess(res, result, 200, 'Demo session initialized');
    } catch (err) {
      next(err);
    }
  },

  async getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await authService.getCurrentUser(req.user!.uid);
      sendSuccess(res, user, 200);
    } catch (err) {
      next(err);
    }
  },

  async sync(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { university, major, photoUrl } = req.body;
      const user = req.user!;
      const synced = await authService.syncUser(
        user.uid,
        user.email,
        user.displayName,
        photoUrl,
        university,
        major,
      );
      sendSuccess(res, { user: synced }, 200, 'User synchronized successfully');
    } catch (err) {
      next(err);
    }
  },

  async updateProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { displayName, university, major } = req.body;
      const updated = await authService.updateProfile(req.user!.uid, {
        displayName,
        university,
        major,
      });
      sendSuccess(res, { user: updated }, 200, 'Profile updated successfully');
    } catch (err) {
      next(err);
    }
  },
};
