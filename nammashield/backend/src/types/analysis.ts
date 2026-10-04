export const ANALYSIS_ENGINE_VERSION = 'analysis-engine-v1';

export const ANALYSIS_INPUT_TYPES = ['text', 'url', 'screenshot', 'mixed'] as const;
export type AnalysisInputType = (typeof ANALYSIS_INPUT_TYPES)[number];

export const ANALYSIS_SOURCES = ['web', 'extension', 'whatsapp'] as const;
export type AnalysisSource = (typeof ANALYSIS_SOURCES)[number];

export const ANALYSIS_RISK_LEVELS = [
  'HIGH_CONCERN',
  'NEEDS_VERIFICATION',
  'NO_STRONG_WARNING_SIGNS',
] as const;
export type AnalysisRiskLevel = (typeof ANALYSIS_RISK_LEVELS)[number];

export const ANALYSIS_REASON_CATEGORIES = [
  'urgency',
  'credential_request',
  'payment_request',
  'impersonation',
  'suspicious_link',
  'suspicious_domain',
  'unusual_language',
  'threat_or_pressure',
  'request_for_sensitive_information',
  'apk_installation',
  'fake_reward_or_refund',
  'off_platform_contact',
  'other',
] as const;
export type AnalysisReasonCategory = (typeof ANALYSIS_REASON_CATEGORIES)[number];

export const ANALYSIS_SIGNAL_SOURCES = ['rule', 'dataset', 'gemini', 'url', 'ocr'] as const;
export type AnalysisSignalSource = (typeof ANALYSIS_SIGNAL_SOURCES)[number];
export type AnalysisSeverity = 'low' | 'medium' | 'high';
export type IndicatorType = 'URL' | 'DOMAIN' | 'PHONE' | 'EMAIL' | 'UPI_ID' | 'PHRASE';

export interface AnalysisInput {
  inputType: AnalysisInputType;
  source: AnalysisSource;
  content?: string;
  extractedText?: string;
  url?: string;
  metadata?: {
    locale?: string;
  };
  category?: string;
  location?: {
    city?: string;
    district?: string;
    region?: string;
  };
}

export interface AnalysisReason {
  category: AnalysisReasonCategory;
  message: string;
  severity: AnalysisSeverity;
  source: AnalysisSignalSource;
}

export interface AnalysisEvidence {
  type: 'text_pattern' | 'url_pattern' | 'indicator_match';
  description: string;
  source: AnalysisSignalSource;
}

export interface AnalysisIndicator {
  type: IndicatorType;
  value: string;
  source: AnalysisSignalSource;
  normalizedValue?: string;
  confidence?: number;
  evidence?: string;
}

export interface NormalizedAnalysisIndicator extends AnalysisIndicator {
  normalizedValue: string;
  confidence: number;
  evidence: string;
}

export interface AnalysisSignal {
  reason: AnalysisReason;
  evidence: readonly AnalysisEvidence[];
  indicators?: readonly AnalysisIndicator[];
}

export interface AnalysisProviderAssessment {
  provider: string;
  suspectedCategory: AnalysisReasonCategory | null;
  requestedAction: string | null;
  uncertainty: string;
  suggestedRiskLevel: AnalysisRiskLevel;
  confidence: number;
}

export interface AnalysisProviderResult {
  signals: AnalysisSignal[];
  indicators?: AnalysisIndicator[];
  assessment?: AnalysisProviderAssessment;
  urls?: AnalysisUrl[];
}

export interface AnalysisProviderWarning {
  provider: string;
  message: string;
}

export interface AnalysisUrlSignal {
  type: string;
  description: string;
  severity: AnalysisSeverity;
}

export interface AnalysisUrl {
  url: string;
  normalizedUrl: string;
  scheme: string;
  hostname: string;
  domain: string;
  subdomain: string | null;
  port: number | null;
  path: string;
  queryParameters: Array<{ name: string; value?: string }>;
  signals: AnalysisUrlSignal[];
}

export interface OcrMetadata {
  status: 'complete' | 'low_confidence' | 'failed';
  extractedText: string;
  meanConfidence: number | null;
  language: 'en' | 'ta-Latn' | 'ta' | 'mixed' | 'unknown';
  script: 'Latin' | 'Tamil' | 'Mixed' | 'Unknown';
  needsReview: boolean;
  warning?: string;
}

export interface AnalysisResult {
  riskLevel: AnalysisRiskLevel;
  category: AnalysisReasonCategory | null;
  summary: string;
  uncertainty: string;
  requestedAction: string | null;
  reasons: AnalysisReason[];
  evidence: AnalysisEvidence[];
  confidence: number;
  indicators: NormalizedAnalysisIndicator[];
  urls: AnalysisUrl[];
  ocr?: OcrMetadata;
  providersUsed: string[];
  providerAssessments: AnalysisProviderAssessment[];
  warnings: AnalysisProviderWarning[];
  analyzerVersion: string;
  analyzedAt: Date;
}
