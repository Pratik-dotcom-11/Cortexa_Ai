import { Request } from 'express';
import { validateRequest, isPositiveInteger } from './validation.util.ts';

export const validateStudyPlanIdParam = validateRequest([
  (req: Request) => {
    if (!isPositiveInteger(req.params.id)) {
      return 'Study plan ID must be a valid positive integer';
    }
    return null;
  },
]);

export const validateCreateStudyPlan = validateRequest([
  (req: Request) => {
    const { subjectId } = req.body;
    if (!subjectId || !isPositiveInteger(subjectId)) {
      return 'Valid subjectId is required';
    }
    return null;
  },
  (req: Request) => {
    const { title } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return 'Plan title is required';
    }
    return null;
  },
  (req: Request) => {
    const { dailyGoals } = req.body;
    if (dailyGoals !== undefined && !Array.isArray(dailyGoals)) {
      return 'dailyGoals must be an array';
    }
    return null;
  },
]);

export const validateUpdateStudyPlan = validateRequest([
  (req: Request) => {
    if (!isPositiveInteger(req.params.id)) {
      return 'Study plan ID must be a valid positive integer';
    }
    return null;
  },
]);
