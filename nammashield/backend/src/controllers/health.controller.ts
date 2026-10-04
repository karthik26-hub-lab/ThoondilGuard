import type { RequestHandler } from 'express';
import { isDatabaseConnected } from '../config/database.js';

export const getHealth: RequestHandler = (_request, response) => {
  response.status(200).json({
    success: true,
    status: 'ok',
    service: 'ThoondilGuard API',
    version: '1.0.0',
  });
};

export const getDatabaseHealth: RequestHandler = (_request, response) => {
  if (!isDatabaseConnected()) {
    response.status(503).json({
      success: false,
      data: {
        database: 'mongodb',
        status: 'disconnected',
      },
      message: 'Database unavailable',
    });
    return;
  }

  response.status(200).json({
    success: true,
    data: {
      database: 'mongodb',
      status: 'connected',
    },
  });
};
