import { Alert } from '../models/Alert.js';
import { ThreatIndicator } from '../models/ThreatIndicator.js';
import { AppError } from '../utils/AppError.js';

export interface PublicThreatIndicator {
  type: 'DOMAIN';
  value: string;
}

export async function getPublicThreatIndicators(): Promise<{ items: PublicThreatIndicator[] }> {
  try {
    // Only domains explicitly associated with a published, reviewed alert can be public.
    const indicatorIds = await Alert.distinct('indicatorIds', { status: 'PUBLISHED' }).exec();
    if (indicatorIds.length === 0) return { items: [] };

    const indicators = await ThreatIndicator.find({
      _id: { $in: indicatorIds },
      type: 'DOMAIN',
    })
      .select({ _id: 0, type: 1, normalizedValue: 1 })
      .sort({ normalizedValue: 1 })
      .lean()
      .exec();

    return {
      items: indicators
        .filter((indicator) => indicator.normalizedValue.length > 0)
        .map((indicator) => ({ type: 'DOMAIN', value: indicator.normalizedValue })),
    };
  } catch {
    throw new AppError('Database unavailable', 503);
  }
}
