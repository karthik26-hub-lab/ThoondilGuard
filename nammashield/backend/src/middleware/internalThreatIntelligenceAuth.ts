import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { env } from '../config/env.js';

export function internalThreatIntelligenceAuth(token = env.internalThreatIntelligenceToken): RequestHandler {
  return (request, response, next) => {
    if (!token || token.length < 32) {
      response.status(503).json({ success: false, message: 'Internal threat intelligence API is not enabled' });
      return;
    }
    const authorization = request.get('authorization') ?? '';
    const provided = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    const expectedBytes = Buffer.from(token);
    const providedBytes = Buffer.from(provided);
    if (providedBytes.length !== expectedBytes.length || !timingSafeEqual(providedBytes, expectedBytes)) {
      response.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    next();
  };
}
