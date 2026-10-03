import { Router } from 'express';
import { aiController } from '../controllers/ai.controller.ts';
import { authenticateToken } from '../middleware/auth.middleware.ts';
import {
  validateAiSummarize,
  validateAiExplain,
  validateAiChat,
  validateAiGenerateQuiz,
  validateAiGenerateFlashcards,
} from '../validators/ai.validator.ts';

const router = Router();

// Protect AI routes with authentication
router.use(authenticateToken);

// POST /api/ai/summarize
router.post('/summarize', validateAiSummarize, aiController.summarize);

// POST /api/ai/explain
router.post('/explain', validateAiExplain, aiController.explain);

// POST /api/ai/chat & /api/ai/rag/query & /api/ai/ask
router.post('/chat', validateAiChat, aiController.chat);
router.post('/rag/query', validateAiChat, aiController.ragQuery);
router.post('/ask', validateAiChat, aiController.ragQuery);

// POST /api/ai/generate-quiz & /api/ai/quiz
router.post('/generate-quiz', validateAiGenerateQuiz, aiController.generateQuiz);
router.post('/quiz', validateAiGenerateQuiz, aiController.generateQuiz);

// POST /api/ai/generate-flashcards & /api/ai/flashcards
router.post('/generate-flashcards', validateAiGenerateFlashcards, aiController.generateFlashcards);
router.post('/flashcards', validateAiGenerateFlashcards, aiController.generateFlashcards);

// POST /api/ai/study-plan & /api/ai/generate-study-plan
router.post('/study-plan', aiController.generateStudyPlan);
router.post('/generate-study-plan', aiController.generateStudyPlan);

export default router;
