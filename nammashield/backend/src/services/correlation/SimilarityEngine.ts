import type { NormalizedAnalysisIndicator } from '../../types/analysis.js';
import type { ReportCorrelationLevel, ReportCorrelationReason } from '../../models/Report.js';

const WEIGHTS: Record<NormalizedAnalysisIndicator['type'], number> = {
  URL: 0.82,
  DOMAIN: 0.62,
  PHONE: 0.76,
  EMAIL: 0.76,
  UPI_ID: 0.78,
  PHRASE: 0.28,
};
const GENERIC_PHRASE_WORDS = new Set([
  'otp', 'bank', 'parcel', 'kyc', 'account', 'required', 'verify', 'verification', 'your', 'is',
  'code', 'please', 'immediately', 'urgent', 'blocked', 'click', 'link',
]);

export interface SimilarityResult {
  related: boolean;
  level: ReportCorrelationLevel | 'UNRELATED';
  score: number;
  reasons: ReportCorrelationReason[];
}

function phraseWeight(value: string): number {
  const meaningful = value.toLowerCase().match(/[a-z0-9]+/gu) ?? [];
  if (meaningful.length < 3 || meaningful.every((word) => GENERIC_PHRASE_WORDS.has(word))) return 0.005;
  return WEIGHTS.PHRASE;
}

function reasonFor(indicator: NormalizedAnalysisIndicator): ReportCorrelationReason {
  const weight = indicator.type === 'PHRASE' ? phraseWeight(indicator.normalizedValue) : WEIGHTS[indicator.type];
  const labels: Record<NormalizedAnalysisIndicator['type'], string> = {
    URL: 'SHARED_URL', DOMAIN: 'SHARED_DOMAIN', PHONE: 'SHARED_PHONE',
    EMAIL: 'SHARED_EMAIL', UPI_ID: 'SHARED_UPI_ID', PHRASE: 'SHARED_PHRASE',
  };
  const explanations: Record<NormalizedAnalysisIndicator['type'], string> = {
    URL: 'Both reports contain the same normalized URL.',
    DOMAIN: 'Both reports contain a URL or domain on the same normalized domain.',
    PHONE: 'Both reports contain the same normalized phone number.',
    EMAIL: 'Both reports contain the same normalized email address.',
    UPI_ID: 'Both reports contain the same normalized UPI/VPA identifier.',
    PHRASE: weight < 0.1
      ? 'Both reports contain a generic phrase; this is weak context only.'
      : 'Both reports contain the same normalized action or pressure phrase.',
  };
  return {
    type: labels[indicator.type],
    indicatorType: indicator.type,
    value: indicator.normalizedValue,
    weight,
    explanation: explanations[indicator.type],
  };
}

export class SimilarityEngine {
  compare(sharedIndicators: readonly NormalizedAnalysisIndicator[]): SimilarityResult {
    const unique = new Map<string, NormalizedAnalysisIndicator>();
    for (const indicator of sharedIndicators) {
      const key = `${indicator.type}:${indicator.normalizedValue.toLowerCase()}`;
      if (!unique.has(key)) unique.set(key, indicator);
    }

    const reasons = [...unique.values()].map(reasonFor).sort((a, b) => b.weight - a.weight).slice(0, 20);
    const independentSignals = new Map<string, number>();
    for (const reason of reasons) {
      let key = `${reason.indicatorType}:${reason.value}`;
      if (reason.indicatorType === 'DOMAIN') key = `host:${reason.value}`;
      if (reason.indicatorType === 'URL') {
        try { key = `host:${new URL(reason.value).hostname.toLowerCase()}`; } catch { /* Keep the URL-specific key. */ }
      }
      independentSignals.set(key, Math.max(independentSignals.get(key) ?? 0, reason.weight));
    }
    const score = Number((1 - [...independentSignals.values()].reduce((remaining, weight) => remaining * (1 - weight), 1)).toFixed(3));
    const level: SimilarityResult['level'] = score >= 0.7
      ? 'STRONG_RELATION'
      : score >= 0.45
        ? 'MODERATE_RELATION'
        : score >= 0.15
          ? 'WEAK_RELATION'
          : 'UNRELATED';

    return { related: level === 'STRONG_RELATION' || level === 'MODERATE_RELATION', level, score, reasons };
  }
}
