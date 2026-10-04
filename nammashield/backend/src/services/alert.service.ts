import { Alert, type AlertDocument } from '../models/Alert.js';
import { AppError } from '../utils/AppError.js';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const MAX_PAGE = 1_000_000;

export interface PublicAlert {
  alertId: string;
  title: string;
  description: string;
  category?: string;
  region?: AlertDocument['region'];
  publishedAt: Date | null;
}

export interface PaginatedAlerts {
  items: PublicAlert[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function parsePageValue(value: unknown, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new AppError(`Invalid ${name}`, 400);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_PAGE) {
    throw new AppError(`Invalid ${name}`, 400);
  }
  return parsed;
}

export async function getPublishedAlerts(pageValue: unknown, limitValue: unknown): Promise<PaginatedAlerts> {
  const page = parsePageValue(pageValue, DEFAULT_PAGE, 'page');
  const requestedLimit = parsePageValue(limitValue, DEFAULT_LIMIT, 'limit');
  const limit = Math.min(requestedLimit, MAX_LIMIT);
  const filter = { status: 'PUBLISHED' as const };
  const skip = (page - 1) * limit;

  try {
    const [total, alerts] = await Promise.all([
      Alert.countDocuments(filter).exec(),
      Alert.find(filter)
        .select({ _id: 0, alertId: 1, title: 1, description: 1, category: 1, region: 1, publishedAt: 1 })
        .sort({ publishedAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
    ]);

    const items: PublicAlert[] = alerts.map((alert) => ({
      alertId: alert.alertId,
      title: alert.title,
      description: alert.description,
      ...(alert.category ? { category: alert.category } : {}),
      ...(alert.region ? { region: alert.region } : {}),
      publishedAt: alert.publishedAt,
    }));

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Database unavailable', 503);
  }
}
