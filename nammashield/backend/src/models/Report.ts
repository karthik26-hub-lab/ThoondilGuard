import mongoose, { type Types } from 'mongoose';
import {
  ANALYSIS_REASON_CATEGORIES,
  ANALYSIS_RISK_LEVELS,
  ANALYSIS_SIGNAL_SOURCES,
} from '../types/analysis.js';
import type {
  AnalysisEvidence,
  AnalysisIndicator,
  AnalysisProviderAssessment,
  AnalysisProviderWarning,
  AnalysisReason,
} from '../types/analysis.js';

export const REPORT_INPUT_TYPES = ['text', 'url', 'screenshot', 'mixed'] as const;
export const REPORT_SOURCES = ['web', 'extension', 'whatsapp'] as const;
export const REPORT_CATEGORIES = [
  'bank_impersonation',
  'payment_fraud',
  'delivery_scam',
  'job_scam',
  'investment_scam',
  'account_takeover',
  'phishing',
  'government_impersonation',
  'social_media_scam',
  'romance_scam',
  'other',
] as const;
export const REPORT_RISK_LEVELS = [
  'HIGH_CONCERN',
  'NEEDS_VERIFICATION',
  'NO_STRONG_WARNING_SIGNS',
] as const;
export const REPORT_STATUSES = [
  'NEW',
  'UNDER_REVIEW',
  'CORRELATED',
  'ESCALATED',
  'ACTION_INITIATED',
  'CLOSED',
  'MONITORED',
] as const;

export type ReportInputType = (typeof REPORT_INPUT_TYPES)[number];
export type ReportSource = (typeof REPORT_SOURCES)[number];
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];
export type ReportRiskLevel = (typeof REPORT_RISK_LEVELS)[number];
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export interface ReportLocation {
  region?: string;
  district?: string;
  city?: string;
}

export interface ReportAnalysis {
  summary?: string;
  reasons?: string[];
  reasonDetails?: AnalysisReason[];
  evidence?: AnalysisEvidence[];
  indicators?: AnalysisIndicator[];
  providerAssessments?: AnalysisProviderAssessment[];
  warnings?: AnalysisProviderWarning[];
  confidence?: number;
  uncertainty?: string;
  requestedAction?: string | null;
  suspectedCategory?: string | null;
  analyzedAt?: Date;
  analyzerVersion?: string;
}

export type ReportCorrelationLevel = 'STRONG_RELATION' | 'MODERATE_RELATION' | 'WEAK_RELATION';
export interface ReportCorrelationReason {
  type: string;
  indicatorType: string;
  value: string;
  weight: number;
  explanation: string;
}
export interface RelatedReport {
  reportId: Types.ObjectId;
  level: ReportCorrelationLevel;
  score: number;
  reasons: ReportCorrelationReason[];
  correlatedAt: Date;
}

export interface ReportDocument extends mongoose.Document {
  referenceId: string;
  inputType: ReportInputType;
  source: ReportSource;
  category?: ReportCategory;
  riskLevel: ReportRiskLevel | null;
  content?: string;
  extractedText?: string;
  indicators: Types.ObjectId[];
  location?: ReportLocation;
  status: ReportStatus;
  campaignIds: Types.ObjectId[];
  relatedReports: RelatedReport[];
  caseIds: Types.ObjectId[];
  analysis?: ReportAnalysis;
  reportedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const locationSchema = new mongoose.Schema<ReportLocation>(
  {
    region: { type: String, trim: true, maxlength: 120 },
    district: { type: String, trim: true, maxlength: 120 },
    city: { type: String, trim: true, maxlength: 120 },
  },
  { _id: false },
);

const analysisSchema = new mongoose.Schema<ReportAnalysis>(
  {
    summary: { type: String, trim: true, maxlength: 2_000 },
    reasons: {
      type: [{ type: String, trim: true, maxlength: 500 }],
      validate: {
        validator: (reasons: string[]) => reasons.length <= 20,
        message: 'Analysis can contain at most 20 reasons',
      },
    },
    reasonDetails: {
      type: [new mongoose.Schema<AnalysisReason>({
        category: { type: String, enum: ANALYSIS_REASON_CATEGORIES, required: true },
        message: { type: String, trim: true, required: true, maxlength: 500 },
        severity: { type: String, enum: ['low', 'medium', 'high'], required: true },
        source: { type: String, enum: ANALYSIS_SIGNAL_SOURCES, required: true },
      }, { _id: false })],
      default: undefined,
      validate: {
        validator: (reasons: AnalysisReason[]) => reasons.length <= 20,
        message: 'Analysis can contain at most 20 structured reasons',
      },
    },
    evidence: {
      type: [new mongoose.Schema<AnalysisEvidence>({
        type: { type: String, enum: ['text_pattern', 'url_pattern', 'indicator_match'], required: true },
        description: { type: String, trim: true, required: true, maxlength: 500 },
        source: { type: String, enum: ANALYSIS_SIGNAL_SOURCES, required: true },
      }, { _id: false })],
      default: undefined,
      validate: {
        validator: (items: AnalysisEvidence[]) => items.length <= 50,
        message: 'Analysis can contain at most 50 evidence items',
      },
    },
    indicators: {
      type: [new mongoose.Schema<AnalysisIndicator>({
        type: { type: String, enum: ['URL', 'DOMAIN', 'PHONE', 'EMAIL', 'UPI_ID', 'PHRASE'], required: true },
        value: { type: String, trim: true, required: true, maxlength: 2_048 },
        source: { type: String, enum: ANALYSIS_SIGNAL_SOURCES, required: true },
        normalizedValue: { type: String, trim: true, maxlength: 2_048 },
        confidence: { type: Number, min: 0, max: 1 },
        evidence: { type: String, trim: true, maxlength: 500 },
      }, { _id: false })],
      default: undefined,
      validate: {
        validator: (items: AnalysisIndicator[]) => items.length <= 100,
        message: 'Analysis can contain at most 100 indicators',
      },
    },
    providerAssessments: {
      type: [new mongoose.Schema<AnalysisProviderAssessment>({
        provider: { type: String, trim: true, required: true, maxlength: 80 },
        suspectedCategory: { type: String, enum: [...ANALYSIS_REASON_CATEGORIES, null], default: null },
        requestedAction: { type: String, trim: true, maxlength: 300, default: null },
        uncertainty: { type: String, trim: true, required: true, maxlength: 500 },
        suggestedRiskLevel: { type: String, enum: ANALYSIS_RISK_LEVELS, required: true },
        confidence: { type: Number, min: 0, max: 1, required: true },
      }, { _id: false })],
      default: undefined,
      validate: {
        validator: (items: AnalysisProviderAssessment[]) => items.length <= 10,
        message: 'Analysis can contain at most 10 provider assessments',
      },
    },
    warnings: {
      type: [new mongoose.Schema<AnalysisProviderWarning>({
        provider: { type: String, trim: true, required: true, maxlength: 80 },
        message: { type: String, trim: true, required: true, maxlength: 300 },
      }, { _id: false })],
      default: undefined,
      validate: {
        validator: (items: AnalysisProviderWarning[]) => items.length <= 10,
        message: 'Analysis can contain at most 10 provider warnings',
      },
    },
    confidence: { type: Number, min: 0, max: 1 },
    uncertainty: { type: String, trim: true, maxlength: 1_000 },
    requestedAction: { type: String, trim: true, maxlength: 300 },
    suspectedCategory: { type: String, trim: true, maxlength: 80 },
    analyzedAt: Date,
    analyzerVersion: { type: String, trim: true, maxlength: 80 },
  },
  { _id: false },
);

const reportSchema = new mongoose.Schema<ReportDocument>(
  {
    referenceId: { type: String, required: true, unique: true, trim: true, maxlength: 40 },
    inputType: { type: String, enum: REPORT_INPUT_TYPES, required: true },
    source: { type: String, enum: REPORT_SOURCES, required: true },
    category: { type: String, enum: REPORT_CATEGORIES },
    riskLevel: { type: String, enum: [...REPORT_RISK_LEVELS, null], default: null },
    content: { type: String, trim: true, maxlength: 20_000 },
    extractedText: { type: String, trim: true, maxlength: 50_000 },
    indicators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ThreatIndicator' }],
    location: { type: locationSchema, default: undefined },
    status: { type: String, enum: REPORT_STATUSES, required: true, default: 'NEW' },
    campaignIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' }],
    relatedReports: {
      type: [new mongoose.Schema<RelatedReport>({
        reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'Report', required: true },
        level: { type: String, enum: ['STRONG_RELATION', 'MODERATE_RELATION', 'WEAK_RELATION'], required: true },
        score: { type: Number, min: 0, max: 1, required: true },
        reasons: { type: [new mongoose.Schema<ReportCorrelationReason>({
          type: { type: String, required: true, maxlength: 40 },
          indicatorType: { type: String, enum: ['URL', 'DOMAIN', 'PHONE', 'EMAIL', 'UPI_ID', 'PHRASE'], required: true },
          value: { type: String, required: true, trim: true, maxlength: 2_048 },
          weight: { type: Number, min: 0, max: 1, required: true },
          explanation: { type: String, required: true, trim: true, maxlength: 300 },
        }, { _id: false })], validate: { validator: (items: ReportCorrelationReason[]) => items.length <= 20 } },
        correlatedAt: { type: Date, required: true },
      }, { _id: false })],
      default: [],
    },
    caseIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Case' }],
    analysis: { type: analysisSchema, default: undefined },
    reportedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
);

reportSchema.index({ status: 1 });
reportSchema.index({ category: 1 });
reportSchema.index({ createdAt: -1 });
reportSchema.index({ 'relatedReports.reportId': 1 });

export const Report = (mongoose.models.Report as mongoose.Model<ReportDocument> | undefined)
  ?? mongoose.model<ReportDocument>('Report', reportSchema);
