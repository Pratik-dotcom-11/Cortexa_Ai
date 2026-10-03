import { Router } from 'express';
import { quizzesController } from '../controllers/quizzes.controller.ts';
import { authenticateToken } from '../middleware/auth.middleware.ts';
import {
  validateGenerateQuiz,
  validateSubmitQuiz,
  validateQuizIdParam,
} from '../validators/quizzes.validator.ts';

const router = Router();

// Protect all quiz routes
router.use(authenticateToken);

// POST /api/quizzes/generate
router.post('/generate', validateGenerateQuiz, quizzesController.generateQuiz);

// GET /api/quizzes
router.get('/', quizzesController.getQuizzes);

// GET /api/quizzes/:id
router.get('/:id', validateQuizIdParam, quizzesController.getQuizById);

// POST /api/quizzes/:id/submit
router.post('/:id/submit', validateSubmitQuiz, quizzesController.submitQuiz);

// DELETE /api/quizzes/:id
router.delete('/:id', validateQuizIdParam, quizzesController.deleteQuiz);

export default router;
