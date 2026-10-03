import { Router } from 'express';
import { studyPlanController } from '../controllers/studyPlan.controller.ts';
import { aiController } from '../controllers/ai.controller.ts';
import { authenticateToken } from '../middleware/auth.middleware.ts';
import {
  validateCreateStudyPlan,
  validateUpdateStudyPlan,
  validateStudyPlanIdParam,
} from '../validators/studyPlan.validator.ts';

const router = Router();

// Protect all study-plan routes
router.use(authenticateToken);

// GET /api/study-plan
router.get('/', studyPlanController.getStudyPlans);

// POST /api/study-plan/generate (AI Generation)
router.post('/generate', aiController.generateStudyPlan);

// POST /api/study-plan
router.post('/', validateCreateStudyPlan, studyPlanController.createStudyPlan);

// GET /api/study-plan/:id
router.get('/:id', validateStudyPlanIdParam, studyPlanController.getStudyPlanById);

// PUT /api/study-plan/:id
router.put('/:id', validateUpdateStudyPlan, studyPlanController.updateStudyPlan);

// DELETE /api/study-plan/:id
router.delete('/:id', validateStudyPlanIdParam, studyPlanController.deleteStudyPlan);

export default router;
