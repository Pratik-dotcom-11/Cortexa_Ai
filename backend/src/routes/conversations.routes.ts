import { Router } from 'express';
import { conversationsController } from '../controllers/conversations.controller.ts';
import { authenticateToken } from '../middleware/auth.middleware.ts';
import {
  validateCreateConversation,
  validateSendMessage,
  validateConversationId,
} from '../validators/conversations.validator.ts';

const router = Router();

router.use(authenticateToken);

// GET /api/conversations - List all conversations
router.get('/', conversationsController.getConversations);

// POST /api/conversations - Create a new conversation
router.post('/', validateCreateConversation, conversationsController.createConversation);

// GET /api/conversations/:id - Get conversation by id
router.get('/:id', validateConversationId, conversationsController.getConversationById);

// PATCH /api/conversations/:id - Update conversation context or title
router.patch('/:id', validateConversationId, conversationsController.updateConversation);

// DELETE /api/conversations/:id - Delete conversation
router.delete('/:id', validateConversationId, conversationsController.deleteConversation);

// POST /api/conversations/:id/messages - Send a message in conversation
router.post(
  '/:id/messages',
  validateConversationId,
  validateSendMessage,
  conversationsController.sendMessage,
);

export default router;
