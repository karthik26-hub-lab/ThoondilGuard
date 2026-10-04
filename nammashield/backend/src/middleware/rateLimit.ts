import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { MongoRateLimitStore } from '../services/rateLimitStore.js';
import { AppError } from '../utils/AppError.js';
import type { Response } from 'express';

const windowMs = 15 * 60 * 1_000;

export function persistentRateLimit(scope: string, limit: number, duration = windowMs) {
  return rateLimit({
    windowMs: duration,
    limit,
    store: new MongoRateLimitStore(scope, duration),
    // Express resolves req.ip using the explicit trusted proxy list; never read
    // forwarding headers here. ipKeyGenerator groups IPv6 addresses by subnet.
    keyGenerator: req => ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? 'unknown'),
    passOnStoreError: false,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many requests. Please try again later.',
    },
  });
}

export const reportSubmissionRateLimit = persistentRateLimit('legacy-report-submit', 30);
export const reportTrackingRateLimit = persistentRateLimit('legacy-report-track', 60);

export async function consumeBudget(scope: string, key: string, limit: number, duration: number, res: Response) {
  const hit = await new MongoRateLimitStore(scope, duration).increment(key);
  if (hit.totalHits > limit) {
    res.setHeader('Retry-After', Math.max(1, Math.ceil(((hit.resetTime?.getTime() ?? Date.now() + duration) - Date.now()) / 1000)));
    throw new AppError('Please wait before trying again', 429);
  }
  return hit;
}
