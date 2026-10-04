import type { ErrorRequestHandler } from 'express';
import { AppError } from '../utils/AppError.js';

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof Error && error.name === 'MulterError') {
    const tooLarge = 'code' in error && error.code === 'LIMIT_FILE_SIZE';
    response.status(tooLarge ? 413 : 422).json({success:false,message:tooLarge?'Screenshot must be smaller than 5 MB':'Invalid screenshot upload'});
    return;
  }
  if (error instanceof AppError) {
    console.error('AppError:', error.message, error.statusCode, error.errors);
    response.status(error.statusCode).json({
      success: false,
      message: error.message,
      ...(error.errors ? { errors: error.errors } : {}),
    });
    return;
  }

  // Express's JSON parser reports malformed and oversized payloads with status codes.
  if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
    response.status(400).json({
      success: false,
      message: 'Invalid JSON payload',
    });
    return;
  }

  if (typeof error === 'object' && error !== null && 'status' in error && error.status === 413) {
    response.status(413).json({ success: false, message: 'Request body is too large' });
    return;
  }

  console.error('Unhandled API Error:', error);
  response.status(500).json({
    success: false,
    message: 'An unexpected error occurred',
  });
};
