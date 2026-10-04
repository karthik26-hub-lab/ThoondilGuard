import type { RequestHandler } from 'express';
import { getPublishedAlerts } from '../services/alert.service.js';

export const getAlerts: RequestHandler = async (request, response, next) => {
  try {
    const data = await getPublishedAlerts(request.query.page, request.query.limit);
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
