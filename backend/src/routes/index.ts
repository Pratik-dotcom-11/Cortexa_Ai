import { Router } from 'express';
import authRoutes from './auth.routes.ts';
import subjectsRoutes from './subjects.routes.ts';
import materialsRoutes from './materials.routes.ts';
import quizzesRoutes from './quizzes.routes.ts';
import flashcardsRoutes from './flashcards.routes.ts';
import progressRoutes from './progress.routes.ts';
import studyPlanRoutes from './studyPlan.routes.ts';
import aiRoutes from './ai.routes.ts';
import conversationsRoutes from './conversations.routes.ts';
import { errorHandler } from '../middleware/error.middleware.ts';

const apiRouter = Router();

// Health check
apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'StudyAI Backend API', timestamp: new Date().toISOString() });
});

// Mount modules
apiRouter.use('/auth', authRoutes);
apiRouter.use('/subjects', subjectsRoutes);
apiRouter.use('/materials', materialsRoutes);
apiRouter.use('/quizzes', quizzesRoutes);
apiRouter.use('/flashcards', flashcardsRoutes);
apiRouter.use('/progress', progressRoutes);
apiRouter.use('/study-plan', studyPlanRoutes);
apiRouter.use('/study-plans', studyPlanRoutes); // Alias for convenience
apiRouter.use('/ai', aiRoutes);
apiRouter.use('/conversations', conversationsRoutes);

// Central API error handling middleware
apiRouter.use(errorHandler);

export default apiRouter;
