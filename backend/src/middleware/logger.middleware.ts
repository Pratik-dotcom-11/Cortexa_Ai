import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.ts';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  const { method, originalUrl } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const logMeta = {
      method,
      url: originalUrl,
      status: statusCode,
      durationMs: duration,
    };

    if (statusCode >= 500) {
      logger.error(`${method} ${originalUrl} ${statusCode} - ${duration}ms`, logMeta);
    } else if (statusCode >= 400) {
      logger.warn(`${method} ${originalUrl} ${statusCode} - ${duration}ms`, logMeta);
    } else {
      logger.info(`${method} ${originalUrl} ${statusCode} - ${duration}ms`, logMeta);
    }
  });

  next();
};
