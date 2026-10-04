import type { RequestHandler } from 'express';
import type { CreateReportInput } from '../types/report.js';
import { AppError } from '../utils/AppError.js';
import { createReport as createReportService, getCitizenReport } from '../services/report.service.js';

export const createReport: RequestHandler = async (request, response, next) => {
  try {
    const data = await createReportService(request.body as CreateReportInput);
    response.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getReportByReference: RequestHandler<{ referenceId: string }> = async (request, response, next) => {
  try {
    const report = await getCitizenReport(request.params.referenceId);
    if (!report) {
      next(new AppError('Report not found', 404));
      return;
    }

    response.status(200).json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
};
