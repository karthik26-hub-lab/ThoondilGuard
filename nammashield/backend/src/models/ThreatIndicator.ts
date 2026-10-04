import mongoose, { type Types } from 'mongoose';

export const THREAT_INDICATOR_TYPES = ['URL', 'DOMAIN', 'PHONE', 'EMAIL', 'UPI_ID', 'PHRASE'] as const;
export type ThreatIndicatorType = (typeof THREAT_INDICATOR_TYPES)[number];

export interface ThreatIndicatorMetadata {
  brand?: string;
  category?: string;
  notes?: string;
}

export interface ThreatIndicatorDocument extends mongoose.Document {
  type: ThreatIndicatorType;
  value: string;
  normalizedValue: string;
  firstSeen: Date;
  lastSeen: Date;
  reportIds: Types.ObjectId[];
  confidence?: number;
  evidence?: string;
  metadata?: ThreatIndicatorMetadata;
  createdAt: Date;
  updatedAt: Date;
}

const metadataSchema = new mongoose.Schema<ThreatIndicatorMetadata>(
  {
    brand: { type: String, trim: true, maxlength: 120 },
    category: { type: String, trim: true, maxlength: 80 },
    notes: { type: String, trim: true, maxlength: 1_000 },
  },
  { _id: false },
);

const threatIndicatorSchema = new mongoose.Schema<ThreatIndicatorDocument>(
  {
    type: { type: String, enum: THREAT_INDICATOR_TYPES, required: true },
    value: { type: String, required: true, trim: true, maxlength: 2_048 },
    normalizedValue: { type: String, required: true, trim: true, maxlength: 2_048 },
    firstSeen: { type: Date, required: true },
    lastSeen: { type: Date, required: true },
    reportIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Report' }],
    confidence: { type: Number, min: 0, max: 1 },
    evidence: { type: String, trim: true, maxlength: 500 },
    metadata: { type: metadataSchema, default: undefined },
  },
  { timestamps: true },
);

threatIndicatorSchema.index({ type: 1, normalizedValue: 1 }, { unique: true });
threatIndicatorSchema.index({ reportIds: 1 });
threatIndicatorSchema.index({ lastSeen: -1 });

export const ThreatIndicator = (
  mongoose.models.ThreatIndicator as mongoose.Model<ThreatIndicatorDocument> | undefined
) ?? mongoose.model<ThreatIndicatorDocument>('ThreatIndicator', threatIndicatorSchema);
