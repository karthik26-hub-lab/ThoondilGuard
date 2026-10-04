import type { RequestHandler } from 'express';
import { createReportInputSchema } from '../types/report.js';
import { AppError } from '../utils/AppError.js';

export const validateReport: RequestHandler = (request, _response, next) => {
  const parsed = createReportInputSchema.safeParse(request.body);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => ({
      field: issue.path.map(String).join('.') || 'body',
      message: issue.message,
    }));
    next(new AppError('Validation failed', 400, errors));
    return;
  }

  // The Zod object strips unknown keys; the service also builds the persisted document explicitly.
  request.body = parsed.data;
  next();
};
