import mongoose, { type Types } from 'mongoose';

export const CASE_STATUSES = [
  'OPEN',
  'UNDER_REVIEW',
  'ESCALATED',
  'ACTION_INITIATED',
  'MONITORED',
  'CLOSED',
] as const;
export const CASE_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
export const CASE_ACTION_TYPES = ['REVIEW', 'PUBLIC_WARNING', 'REFERRAL', 'OTHER'] as const;

export type CaseStatus = (typeof CASE_STATUSES)[number];
export type CasePriority = (typeof CASE_PRIORITIES)[number];
export type CaseActionType = (typeof CASE_ACTION_TYPES)[number];

export interface CaseNote {
  text: string;
  createdAt: Date;
}

export interface CaseAction {
  actionType: CaseActionType;
  description: string;
  createdAt: Date;
}

export interface CaseDocument extends mongoose.Document {
  caseId: string;
  title: string;
  status: CaseStatus;
  priority: CasePriority;
  reportIds: Types.ObjectId[];
  campaignId?: Types.ObjectId;
  assignedTeam?: string;
  notes: CaseNote[];
  actions: CaseAction[];
  createdAt: Date;
  updatedAt: Date;
}

const noteSchema = new mongoose.Schema<CaseNote>(
  {
    text: { type: String, required: true, trim: true, maxlength: 2_000 },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const actionSchema = new mongoose.Schema<CaseAction>(
  {
    actionType: { type: String, enum: CASE_ACTION_TYPES, required: true },
    description: { type: String, required: true, trim: true, maxlength: 1_000 },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const caseSchema = new mongoose.Schema<CaseDocument>(
  {
    caseId: { type: String, required: true, unique: true, trim: true, maxlength: 40 },
    title: { type: String, required: true, trim: true, maxlength: 240 },
    status: { type: String, enum: CASE_STATUSES, required: true, default: 'OPEN' },
    priority: { type: String, enum: CASE_PRIORITIES, required: true, default: 'MEDIUM' },
    reportIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Report' }],
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
    assignedTeam: { type: String, trim: true, maxlength: 160 },
    notes: { type: [noteSchema], default: [] },
    actions: { type: [actionSchema], default: [] },
  },
  { timestamps: true },
);

caseSchema.index({ status: 1 });
caseSchema.index({ createdAt: -1 });

export const Case = (mongoose.models.Case as mongoose.Model<CaseDocument> | undefined)
  ?? mongoose.model<CaseDocument>('Case', caseSchema);
