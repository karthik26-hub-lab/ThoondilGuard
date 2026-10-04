import type { RequestHandler } from 'express';
import { getPublicThreatIndicators } from '../services/threatIntelligence.service.js';

export const getThreatIntelligence: RequestHandler = async (_request, response, next) => {
  try {
    const data = await getPublicThreatIndicators();
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
