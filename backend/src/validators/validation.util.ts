import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.ts';

export type ValidationRule = (req: Request) => string | null;

export const validateRequest = (rules: ValidationRule[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    for (const rule of rules) {
      const error = rule(req);
      if (error) {
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      sendError(res, 'Validation failed', 400, { issues: errors });
      return;
    }

    next();
  };
};

export const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const isPositiveInteger = (value: any): boolean => {
  const num = Number(value);
  return Number.isInteger(num) && num > 0;
};
