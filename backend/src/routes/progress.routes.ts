import { Router } from 'express';
import { progressController } from '../controllers/progress.controller.ts';
import { authenticateToken } from '../middleware/auth.middleware.ts';
import { validateProgressQuery } from '../validators/progress.validator.ts';

const router = Router();

// Protect all progress routes
router.use(authenticateToken);

// GET /api/progress/intelligence (Full Personalized Study Intelligence payload)
router.get('/intelligence', validateProgressQuery, progressController.getIntelligence);

// GET /api/progress/recommendations (Personalized study recommendations)
router.get('/recommendations', validateProgressQuery, progressController.getRecommendations);

// POST /api/progress/recommendations/ai-coach (Grounded AI study coach synthesis)
router.post('/recommendations/ai-coach', progressController.getAiCoaching);

// GET /api/progress
router.get('/', progressController.getProgress);
router.get('/dashboard', progressController.getProgress);

// GET /api/progress/subjects
router.get('/subjects', progressController.getSubjectProgress);

// GET /api/progress/topics
router.get('/topics', validateProgressQuery, progressController.getTopicProgress);
router.get('/weak-topics', validateProgressQuery, progressController.getTopicProgress);

// POST /api/progress/session
router.post('/session', progressController.recordSession);

export default router;
