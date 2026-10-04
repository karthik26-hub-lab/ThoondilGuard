import mongoose, { type Types } from 'mongoose';
import { REPORT_CATEGORIES, type ReportCategory } from './Report.js';

export const CAMPAIGN_STATUSES = ['UNDER_REVIEW', 'REVIEWED', 'ESCALATED', 'CLOSED', 'MONITORED'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
export type CampaignConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface CampaignEvidence {
  type: string;
  indicatorType: string;
  indicatorId: Types.ObjectId;
  displayValue: string;
  weight: number;
  explanation: string;
  supportingReportIds: Types.ObjectId[];
}

export interface CampaignDocument extends mongoose.Document {
  campaignId: string;
  clusterFingerprint?: string;
  name: string;
  category?: ReportCategory;
  status: CampaignStatus;
  reportIds: Types.ObjectId[];
  indicatorIds: Types.ObjectId[];
  confidence?: number;
  confidenceLevel?: CampaignConfidenceLevel;
  evidence: CampaignEvidence[];
  summary?: string;
  firstDetectedAt: Date;
  lastUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const campaignSchema = new mongoose.Schema<CampaignDocument>(
  {
    campaignId: { type: String, required: true, unique: true, trim: true, maxlength: 40 },
    clusterFingerprint: { type: String, trim: true, maxlength: 128 },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    category: { type: String, enum: REPORT_CATEGORIES },
    status: { type: String, enum: CAMPAIGN_STATUSES, required: true, default: 'UNDER_REVIEW' },
    reportIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Report' }],
    indicatorIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ThreatIndicator' }],
    confidence: { type: Number, min: 0, max: 1 },
    confidenceLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'] },
    evidence: {
      type: [new mongoose.Schema<CampaignEvidence>({
        type: { type: String, required: true, trim: true, maxlength: 40 },
        indicatorType: { type: String, enum: ['URL', 'DOMAIN', 'PHONE', 'EMAIL', 'UPI_ID', 'PHRASE'], required: true },
        indicatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'ThreatIndicator', required: true },
        displayValue: { type: String, required: true, trim: true, maxlength: 300 },
        weight: { type: Number, min: 0, max: 1, required: true },
        explanation: { type: String, required: true, trim: true, maxlength: 300 },
        supportingReportIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Report' }],
      }, { _id: false })],
      default: [],
      validate: { validator: (items: CampaignEvidence[]) => items.length <= 50 },
    },
    summary: { type: String, trim: true, maxlength: 2_000 },
    firstDetectedAt: { type: Date, required: true },
    lastUpdatedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

campaignSchema.index({ status: 1 });
campaignSchema.index({ createdAt: -1 });
campaignSchema.index({ clusterFingerprint: 1 }, { unique: true, sparse: true });
campaignSchema.index({ reportIds: 1 });
campaignSchema.index({ status: 1, lastUpdatedAt: -1 });

export const Campaign = (mongoose.models.Campaign as mongoose.Model<CampaignDocument> | undefined)
  ?? mongoose.model<CampaignDocument>('Campaign', campaignSchema);
