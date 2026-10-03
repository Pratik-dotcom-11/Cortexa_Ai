import type { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.ts';
import { materialsService } from '../services/materials.service.ts';
import { sendSuccess } from '../utils/response.ts';
import { BadRequestError } from '../utils/errors.ts';

export const materialsController = {
  async getMaterials(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const subjectId = req.query.subjectId ? Number(req.query.subjectId) : undefined;
      const list = await materialsService.getMaterials(req.user!.uid, subjectId);
      sendSuccess(res, list, 200);
    } catch (err) {
      next(err);
    }
  },

  async getMaterialById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const materialId = Number(req.params.id);
      const material = await materialsService.getMaterialById(req.user!.uid, materialId);
      sendSuccess(res, material, 200);
    } catch (err) {
      next(err);
    }
  },

  async createMaterial(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { subjectId, title, rawText, fileType, fileSize } = req.body;
      const created = await materialsService.createMaterial(req.user!.uid, {
        subjectId: Number(subjectId),
        title,
        rawText,
        fileType,
        fileSize,
      });
      sendSuccess(res, created, 201, 'Study material uploaded and analyzed successfully');
    } catch (err) {
      next(err);
    }
  },

  async uploadPdf(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const file = req.file;
      if (!file) {
        throw new BadRequestError('Upload failed: No file attached');
      }

      const subjectId = req.body.subjectId ? Number(req.body.subjectId) : NaN;
      if (isNaN(subjectId) || subjectId <= 0) {
        throw new BadRequestError('Upload failed: Valid subject ID is required');
      }

      const customTitle = req.body.title ? String(req.body.title).trim() : undefined;

      const created = await materialsService.uploadMaterialFile(
        req.user!.uid,
        subjectId,
        file.buffer,
        file.originalname,
        customTitle,
        file.mimetype,
      );

      const isImage = file.mimetype?.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(file.originalname);
      const msg = isImage
        ? 'Handwritten study notes processed with OCR and added to your study repository'
        : 'Document processed, analyzed, and added to your study repository';

      sendSuccess(res, created, 201, msg);
    } catch (err) {
      next(err);
    }
  },

  async downloadFile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const materialId = Number(req.params.id);
      if (isNaN(materialId) || materialId <= 0) {
        throw new BadRequestError('Invalid material ID');
      }

      const { filePath, fileName } = await materialsService.getMaterialDownloadFile(
        req.user!.uid,
        materialId,
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, no-cache');

      res.sendFile(filePath);
    } catch (err) {
      next(err);
    }
  },

  async deleteMaterial(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const materialId = Number(req.params.id);
      const result = await materialsService.deleteMaterial(req.user!.uid, materialId);
      sendSuccess(res, result, 200, 'Study material deleted successfully');
    } catch (err) {
      next(err);
    }
  },

  async getAnnotations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const materialId = Number(req.params.id);
      const annotations = await materialsService.getAnnotations(req.user!.uid, materialId);
      sendSuccess(res, annotations, 200, 'Annotations retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  async saveAnnotations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const materialId = Number(req.params.id);
      const updated = await materialsService.saveAnnotations(req.user!.uid, materialId, req.body || {});
      sendSuccess(res, updated, 200, 'Annotations saved successfully');
    } catch (err) {
      next(err);
    }
  },
};
