import { Router } from 'express';
import { createReport, getReportByReference } from '../controllers/report.controller.js';
import { reportSubmissionRateLimit, reportTrackingRateLimit } from '../middleware/rateLimit.js';
import { validateReport } from '../middleware/validateReport.js';

const reportRouter = Router();

reportRouter.post('/', reportSubmissionRateLimit, validateReport, createReport);
reportRouter.get('/:referenceId', reportTrackingRateLimit, getReportByReference);

export { reportRouter };
