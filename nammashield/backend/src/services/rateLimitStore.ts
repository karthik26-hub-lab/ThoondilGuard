import type { Store, ClientRateLimitInfo } from 'express-rate-limit';
import { RateLimitCounter } from '../models/RateLimitCounter.js';
import { hash } from './security.js';
import { AppError } from '../utils/AppError.js';
import type mongoose from 'mongoose';

// One atomic update resets an expired window and counts this request. TTL cleanup
// is only housekeeping: correctness never depends on MongoDB deleting on time.
export class MongoRateLimitStore implements Store {
  readonly localKeys = false;
  readonly prefix: string;
  constructor(scope: string, private readonly windowMs: number) {
    this.prefix = scope + ':';
  }
  async increment(key: string): Promise<ClientRateLimitInfo> {
    const now = new Date();
    const reset = { $lte: [{ $ifNull: ['$resetAt', new Date(0)] }, now] };
    const update = [{ $set: {
      count: { $cond: [reset, 1, { $add: ['$count', 1] }] },
      resetAt: { $cond: [reset, new Date(now.getTime() + this.windowMs), '$resetAt'] },
    } }];
    const id = hash(this.prefix + key);
    const collection = RateLimitCounter.collection as unknown as mongoose.mongo.Collection<{_id: string; count: number; resetAt: Date}>;
    try {
      let doc;
      try {
        doc = await collection.findOneAndUpdate(
          { _id: id }, update, { upsert: true, returnDocument: 'after' },
        );
      } catch (error) {
        // Concurrent first requests can race on the unique _id insert.
        if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 11000)) throw error;
        doc = await collection.findOneAndUpdate(
          { _id: id }, update, { returnDocument: 'after' },
        );
      }
      if (!doc || typeof doc.count !== 'number' || !(doc.resetAt instanceof Date)) throw new Error('Invalid counter');
      return { totalHits: doc.count, resetTime: doc.resetAt };
    } catch {
      throw new AppError('Request protection is temporarily unavailable. Please retry later.', 503);
    }
  }
  async decrement(key: string): Promise<void> {
    await RateLimitCounter.updateOne({ _id: hash(this.prefix + key), count: { $gt: 0 } }, { $inc: { count: -1 } });
  }
  async resetKey(key: string): Promise<void> {
    await RateLimitCounter.deleteOne({ _id: hash(this.prefix + key) });
  }
}
