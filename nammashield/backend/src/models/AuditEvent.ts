import mongoose, { type Types } from 'mongoose';

export const AUDIT_ENTITY_TYPES = ['REPORT', 'INDICATOR', 'CAMPAIGN', 'CASE', 'ALERT'] as const;
export const AUDIT_ACTOR_TYPES = ['SYSTEM', 'AUTHORITY'] as const;
export const AUDIT_ACTIONS = [
  'REPORT_CREATED',
  'REPORT_REVIEWED',
  'REPORT_CORRELATED',
  'CAMPAIGN_CREATED',
  'CAMPAIGN_UPDATED',
  'REPORT_LINKED_TO_CAMPAIGN',
  'INDICATOR_LINKED_TO_CAMPAIGN',
  'CAMPAIGN_REVIEWED',
  'CASE_CREATED',
  'CASE_UPDATED',
  'ALERT_DRAFTED',
  'ALERT_PUBLISHED',
  'ALERT_ARCHIVED',
] as const;

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];
export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditEventMetadata {
  reason?: string;
  previousStatus?: string;
  newStatus?: string;
}

export interface AuditEventDocument extends mongoose.Document {
  entityType: AuditEntityType;
  entityId: Types.ObjectId;
  action: AuditAction | string;
  actorType: AuditActorType;
  actorId?: string | null;
  metadata?: AuditEventMetadata;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const entityModelNames: Record<AuditEntityType, string> = {
  REPORT: 'Report',
  INDICATOR: 'ThreatIndicator',
  CAMPAIGN: 'Campaign',
  CASE: 'Case',
  ALERT: 'Alert',
};

const metadataSchema = new mongoose.Schema<AuditEventMetadata>(
  {
    reason: { type: String, trim: true, maxlength: 500 },
    previousStatus: { type: String, trim: true, maxlength: 80 },
    newStatus: { type: String, trim: true, maxlength: 80 },
  },
  { _id: false },
);

const auditEventSchema = new mongoose.Schema<AuditEventDocument>(
  {
    entityType: { type: String, enum: AUDIT_ENTITY_TYPES, required: true },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref(this: AuditEventDocument) {
        return entityModelNames[this.entityType];
      },
    },
    action: { type: String, required: true, trim: true, maxlength: 80 },
    actorType: { type: String, enum: AUDIT_ACTOR_TYPES, required: true, default: 'SYSTEM' },
    actorId: { type: String, trim: true, maxlength: 120, default: null },
    metadata: { type: metadataSchema, default: undefined },
    timestamp: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
);

auditEventSchema.index({ entityType: 1, entityId: 1 });
auditEventSchema.index({ timestamp: -1 });

export const AuditEvent = (mongoose.models.AuditEvent as mongoose.Model<AuditEventDocument> | undefined)
  ?? mongoose.model<AuditEventDocument>('AuditEvent', auditEventSchema);
