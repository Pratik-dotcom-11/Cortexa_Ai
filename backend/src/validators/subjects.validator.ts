import { Request } from 'express';
import { validateRequest, isPositiveInteger } from './validation.util.ts';

export const validateSubjectIdParam = validateRequest([
  (req: Request) => {
    if (!isPositiveInteger(req.params.id)) {
      return 'Subject ID must be a valid positive integer';
    }
    return null;
  },
]);

export const validateCreateSubject = validateRequest([
  (req: Request) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return 'Subject name is required and cannot be empty';
    }
    if (name.trim().length > 100) {
      return 'Subject name cannot exceed 100 characters';
    }
    return null;
  },
  (req: Request) => {
    const { code } = req.body;
    if (code !== undefined && (typeof code !== 'string' || code.trim().length > 20)) {
      return 'Subject code cannot exceed 20 characters';
    }
    return null;
  },
  (req: Request) => {
    const { color } = req.body;
    if (color !== undefined && (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color))) {
      return 'Color must be a valid 6-character hex code (e.g. #6366f1)';
    }
    return null;
  },
]);

export const validateUpdateSubject = validateRequest([
  (req: Request) => {
    if (!isPositiveInteger(req.params.id)) {
      return 'Subject ID must be a valid positive integer';
    }
    return null;
  },
  (req: Request) => {
    const { name } = req.body;
    if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.trim().length > 100)) {
      return 'Subject name must be a non-empty string under 100 characters';
    }
    return null;
  },
]);
