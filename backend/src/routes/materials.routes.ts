import { Router } from 'express';
import { materialsController } from '../controllers/materials.controller.ts';
import { authenticateToken } from '../middleware/auth.middleware.ts';
import { singlePdfUpload } from '../middleware/upload.middleware.ts';
import {
  validateCreateMaterial,
  validateMaterialIdParam,
} from '../validators/materials.validator.ts';

const router = Router();

// Protect all material routes with token authentication
router.use(authenticateToken);

// GET /api/materials
router.get('/', materialsController.getMaterials);

// POST /api/materials/upload (PDF multipart pipeline)
router.post('/upload', singlePdfUpload, materialsController.uploadPdf);

// POST /api/materials (Direct raw text / note creation)
router.post('/', validateCreateMaterial, materialsController.createMaterial);

// GET /api/materials/:id/download (Authorized private PDF file download)
router.get('/:id/download', validateMaterialIdParam, materialsController.downloadFile);

// GET /api/materials/:id
router.get('/:id', validateMaterialIdParam, materialsController.getMaterialById);

// GET /api/materials/:id/annotations
router.get('/:id/annotations', validateMaterialIdParam, materialsController.getAnnotations);

// PUT /api/materials/:id/annotations
router.put('/:id/annotations', validateMaterialIdParam, materialsController.saveAnnotations);

// DELETE /api/materials/:id
router.delete('/:id', validateMaterialIdParam, materialsController.deleteMaterial);

export default router;
