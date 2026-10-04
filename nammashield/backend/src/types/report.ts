import { z } from 'zod';
import {
  REPORT_CATEGORIES,
  REPORT_INPUT_TYPES,
  REPORT_SOURCES,
} from '../models/Report.js';

const locationInputSchema = z.object({
  city: z.string().trim().max(120).optional(),
  district: z.string().trim().max(120).optional(),
  region: z.string().trim().max(120).optional(),
}).strict();

export const createReportInputSchema = z.object({
  inputType: z.enum(REPORT_INPUT_TYPES),
  source: z.enum(REPORT_SOURCES),
  category: z.enum(REPORT_CATEGORIES),
  content: z.string().max(20_000).optional(),
  extractedText: z.string().max(50_000).nullable().optional(),
  location: locationInputSchema.optional(),
}).superRefine((input, context) => {
  if (input.inputType === 'mixed' && !input.content && !input.extractedText) {
    context.addIssue({
      code: 'custom',
      path: ['content'],
      message: 'Mixed input requires content or extractedText',
    });
  }
});

export type CreateReportInput = z.infer<typeof createReportInputSchema>;
