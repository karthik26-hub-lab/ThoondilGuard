import mongoose, { type Types } from 'mongoose';

export const ALERT_STATUSES = ['DRAFT', 'UNDER_REVIEW', 'PUBLISHED', 'ARCHIVED'] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export interface AlertRegion {
  city?: string;
  district?: string;
  state?: string;
}

export interface AlertDocument extends mongoose.Document {
  alertId: string;
  title: string;
  description: string;
  category?: string;
  region?: AlertRegion;
  indicatorIds: Types.ObjectId[];
  sourceCampaignId?: Types.ObjectId;
  status: AlertStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const regionSchema = new mongoose.Schema<AlertRegion>(
  {
    city: { type: String, trim: true, maxlength: 120 },
    district: { type: String, trim: true, maxlength: 120 },
    state: { type: String, trim: true, maxlength: 120 },
  },
  { _id: false },
);

const alertSchema = new mongoose.Schema<AlertDocument>(
  {
    alertId: { type: String, required: true, unique: true, trim: true, maxlength: 40 },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 3_000 },
    category: { type: String, trim: true, maxlength: 80 },
    region: { type: regionSchema, default: undefined },
    indicatorIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ThreatIndicator' }],
    sourceCampaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
    status: { type: String, enum: ALERT_STATUSES, required: true, default: 'DRAFT' },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

alertSchema.index({ status: 1 });
alertSchema.index({ publishedAt: -1 });
alertSchema.index({ status: 1, publishedAt: -1, _id: -1 });

export const Alert = (mongoose.models.Alert as mongoose.Model<AlertDocument> | undefined)
  ?? mongoose.model<AlertDocument>('Alert', alertSchema);
