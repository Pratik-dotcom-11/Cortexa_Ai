import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.ts';
import { sendError } from '../utils/response.ts';
import { logger } from '../utils/logger.ts';

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction,
): void => {
  if (err instanceof AppError) {
    logger.warn(`Handled application error: ${err.message}`, {
      path: req.originalUrl,
      statusCode: err.statusCode,
      details: err.details,
    });
    sendError(res, err.message, err.statusCode, err.details);
    return;
  }

  // Unhandled internal server error
  logger.error(`Unhandled internal error: ${err.message}`, {
    path: req.originalUrl,
    stack: err.stack,
  });

  const message =
    process.env.NODE_ENV === 'production'
      ? 'An unexpected internal error occurred'
      : err.message || 'Internal Server Error';

  sendError(res, message, 500);
};

export const notFoundHandler = (req: Request, res: Response): void => {
  sendError(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
};
