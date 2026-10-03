import type { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: any;
}

export const sendSuccess = <T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  message?: string,
): Response => {
  const response: ApiResponse<T> = {
    success: true,
    data,
  };
  if (message) {
    response.message = message;
  }
  return res.status(statusCode).json(response);
};

export const sendError = (
  res: Response,
  message: string,
  statusCode: number = 400,
  details?: any,
): Response => {
  const response: ApiResponse = {
    success: false,
    error: message,
    message,
  };
  if (details !== undefined) {
    response.details = details;
  }
  return res.status(statusCode).json(response);
};
