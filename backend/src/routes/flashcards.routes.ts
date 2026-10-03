import { Router } from 'express';
import { flashcardsController } from '../controllers/flashcards.controller.ts';
import { authenticateToken } from '../middleware/auth.middleware.ts';
import {
  validateCreateFlashcard,
  validateUpdateFlashcard,
  validateReviewFlashcard,
  validateFlashcardIdParam,
} from '../validators/flashcards.validator.ts';

const router = Router();

// Protect all flashcard routes
router.use(authenticateToken);

// GET /api/flashcards - List flashcards with filters
router.get('/', flashcardsController.getFlashcards);

// GET /api/flashcards/stats - Aggregate flashcard metrics
router.get('/stats', flashcardsController.getStats);

// POST /api/flashcards/generate - AI Flashcard generation
router.post('/generate', flashcardsController.generateFlashcards);

// POST /api/flashcards/bulk-delete - Bulk deletion
router.post('/bulk-delete', flashcardsController.deleteBulk);

// POST /api/flashcards - Create single manual card
router.post('/', validateCreateFlashcard, flashcardsController.createFlashcard);

// GET /api/flashcards/:id - Get single card
router.get('/:id', validateFlashcardIdParam, flashcardsController.getFlashcardById);

// PUT /api/flashcards/:id - Update card
router.put('/:id', validateUpdateFlashcard, flashcardsController.updateFlashcard);

// PATCH /api/flashcards/:id - Partial update card
router.patch('/:id', validateUpdateFlashcard, flashcardsController.updateFlashcard);

// PATCH /api/flashcards/:id/review - Review card (mark known / needs_revision / leitner)
router.patch('/:id/review', validateReviewFlashcard, flashcardsController.reviewFlashcard);

// POST /api/flashcards/:id/review - Review card alias
router.post('/:id/review', validateReviewFlashcard, flashcardsController.reviewFlashcard);

// DELETE /api/flashcards/:id - Delete single card
router.delete('/:id', validateFlashcardIdParam, flashcardsController.deleteFlashcard);

export default router;
