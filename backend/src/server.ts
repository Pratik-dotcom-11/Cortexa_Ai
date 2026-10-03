import express, { Express } from 'express';
import { config } from './config/env.ts';
import apiRouter from './routes/index.ts';
import { requestLogger } from './middleware/logger.middleware.ts';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.ts';
import { logger } from './utils/logger.ts';

export const createBackendApp = (): Express => {
  const app = express();

  // Middleware
  app.use(express.json({ limit: '30mb' }));
  app.use(express.urlencoded({ extended: true, limit: '30mb' }));
  app.use(requestLogger);

  // Mount API router
  app.use('/api', apiRouter);

  // Error handling middleware
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export const app = createBackendApp();

// If executed as standalone entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = config.port;
  app.listen(port, '0.0.0.0', () => {
    logger.info(`StudyAI Backend server running on port ${port}`);
  });
}

export default app;
