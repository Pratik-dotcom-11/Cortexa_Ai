import { Router } from 'express';
import { authController } from '../controllers/auth.controller.ts';
import { validateSignup, validateLogin } from '../validators/auth.validator.ts';
import { authenticateToken } from '../middleware/auth.middleware.ts';

const router = Router();

// POST /api/auth/signup
router.post('/signup', validateSignup, authController.signup);

// POST /api/auth/login
router.post('/login', validateLogin, authController.login);

// POST /api/auth/demo
router.post('/demo', authController.demo);

// POST /api/auth/logout
router.post('/logout', authController.logout);

// GET /api/auth/me
router.get('/me', authenticateToken, authController.getMe);

// POST /api/auth/sync
router.post('/sync', authenticateToken, authController.sync);

// PUT /api/auth/profile
router.put('/profile', authenticateToken, authController.updateProfile);

export default router;
