import { domainToASCII } from 'node:url';
import mongoose from 'mongoose';
import type { NormalizedAnalysisIndicator } from '../../types/analysis.js';
import { Report } from '../../models/Report.js';
import { ThreatIndicator, type ThreatIndicatorType } from '../../models/ThreatIndicator.js';

export function canonicalizeIndicator(indicator: NormalizedAnalysisIndicator): string | null {
  const value = indicator.normalizedValue.trim();
  if (!value) return null;
  if (indicator.type === 'URL') {
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) return null;
      url.hostname = url.hostname.toLowerCase().replace(/\.$/u, '');
      url.hash = '';
      url.username = '';
      url.password = '';
      for (const key of [...url.searchParams.keys()]) {
        if (/(?:token|session|auth|code|email|phone|mobile|otp|key|password|user|account|id)/iu.test(key)) {
          url.searchParams.set(key, '[redacted]');
        }
      }
      return url.toString();
    } catch {
      return null;
    }
  }
  if (indicator.type === 'DOMAIN') {
    try {
      const hostname = value.includes('://') ? new URL(value).hostname : value;
      const ascii = domainToASCII(hostname.replace(/\.$/u, '').toLowerCase());
      return ascii || null;
    } catch {
      return null;
    }
  }
  if (indicator.type === 'PHONE') {
    const digits = value.replace(/\D/gu, '');
    return digits.length >= 10 && digits.length <= 15 ? `${value.startsWith('+') ? '+' : ''}${digits}` : null;
  }
  if (indicator.type === 'EMAIL') return value.toLowerCase();
  if (indicator.type === 'UPI_ID') return value.toLowerCase().replace(/\s+/gu, '');
  return value.toLowerCase().replace(/\s+/gu, ' ');
}

export interface PersistedReportIndicators {
  indicatorIds: mongoose.Types.ObjectId[];
  indicators: NormalizedAnalysisIndicator[];
}

export class IndicatorPersistenceService {
  async persist(reportId: mongoose.Types.ObjectId | string, input: readonly NormalizedAnalysisIndicator[]): Promise<PersistedReportIndicators> {
    const id = new mongoose.Types.ObjectId(reportId);
    const unique = new Map<string, NormalizedAnalysisIndicator>();
    for (const indicator of input) {
      const normalizedValue = canonicalizeIndicator(indicator);
      if (!normalizedValue) continue;
      const key = `${indicator.type}:${normalizedValue}`;
      const existing = unique.get(key);
      unique.set(key, existing
        ? { ...existing, confidence: Math.max(existing.confidence, indicator.confidence), evidence: [existing.evidence, indicator.evidence].filter(Boolean).join(' ').slice(0, 500) }
        : { ...indicator, normalizedValue });
    }

    const now = new Date();
    const indicators = [...unique.values()];
    const records = await Promise.all(indicators.map((indicator) => ThreatIndicator.findOneAndUpdate(
      { type: indicator.type as ThreatIndicatorType, normalizedValue: indicator.normalizedValue },
      {
        $setOnInsert: {
          type: indicator.type,
          normalizedValue: indicator.normalizedValue,
          value: indicator.value,
          firstSeen: now,
          evidence: indicator.evidence,
        },
        $max: { lastSeen: now, confidence: indicator.confidence },
        $addToSet: { reportIds: id },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    ).select({ _id: 1 }).exec()));
    const indicatorIds = records.map(({ _id }) => _id);

    await Report.updateOne(
      { _id: id },
      { $addToSet: { indicators: { $each: indicatorIds } } },
    ).exec();
    return { indicatorIds, indicators };
  }
}
