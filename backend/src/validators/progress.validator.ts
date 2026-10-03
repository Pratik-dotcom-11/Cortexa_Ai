import { Request } from 'express';
import { validateRequest, isPositiveInteger } from './validation.util.ts';

export const validateProgressQuery = validateRequest([
  (req: Request) => {
    const { subjectId } = req.query;
    if (subjectId !== undefined && !isPositiveInteger(subjectId)) {
      return 'subjectId query parameter must be a positive integer';
    }
    return null;
  },
]);
