import { Router } from 'express';
import { subjectsController } from '../controllers/subjects.controller.ts';
import { authenticateToken } from '../middleware/auth.middleware.ts';
import {
  validateCreateSubject,
  validateUpdateSubject,
  validateSubjectIdParam,
} from '../validators/subjects.validator.ts';

const router = Router();

// Protect all subject routes
router.use(authenticateToken);

// GET /api/subjects
router.get('/', subjectsController.getSubjects);

// POST /api/subjects
router.post('/', validateCreateSubject, subjectsController.createSubject);

// GET /api/subjects/:id
router.get('/:id', validateSubjectIdParam, subjectsController.getSubjectById);

// PUT /api/subjects/:id
router.put('/:id', validateUpdateSubject, subjectsController.updateSubject);

// DELETE /api/subjects/:id
router.delete('/:id', validateSubjectIdParam, subjectsController.deleteSubject);

export default router;
