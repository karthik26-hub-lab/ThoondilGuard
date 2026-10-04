import { z } from 'zod';
import { CAMPAIGN_STATUSES, Campaign } from '../models/Campaign.js';
import { Report } from '../models/Report.js';
import { ThreatIndicator } from '../models/ThreatIndicator.js';
import { AppError } from '../utils/AppError.js';

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(CAMPAIGN_STATUSES).optional(),
}).strict();

function parseListQuery(input: unknown): z.infer<typeof listQuerySchema> {
  const parsed = listQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError('Invalid pagination or campaign status', 400,
      parsed.error.issues.map((issue) => ({ field: String(issue.path[0] ?? 'query'), message: issue.message })));
  }
  return parsed.data;
}

function safeIndicatorValue(type: string, value: string): string {
  if (type === 'URL') {
    try { return new URL(value).hostname.toLowerCase(); } catch { return '[URL withheld]'; }
  }
  if (type === 'DOMAIN') return value;
  if (type === 'PHONE') return `••••••${value.replace(/\D/gu, '').slice(-2)}`;
  if (type === 'EMAIL' || type === 'UPI_ID') {
    const [local = '', host = ''] = value.split('@');
    return `${local.slice(0, 1)}***@${host}`;
  }
  return '[phrase text withheld]';
}

function mapEvidence(evidence: Array<{
  type: string;
  indicatorType: string;
  displayValue: string;
  weight: number;
  explanation: string;
  supportingReportIds: unknown[];
}>) {
  return evidence.map(({ type, indicatorType, displayValue, weight, explanation, supportingReportIds }) => ({
    type,
    indicatorType,
    value: displayValue,
    weight,
    explanation,
    supportingReportCount: supportingReportIds.length,
  }));
}

function mapCampaignSummary(campaign: {
  campaignId: string;
  status: string;
  confidence?: number;
  confidenceLevel?: string;
  summary?: string;
  reportIds: unknown[];
  indicatorIds: unknown[];
  evidence: Array<{ type: string; indicatorType: string; displayValue: string; weight: number; explanation: string; supportingReportIds: unknown[] }>;
  firstDetectedAt: Date;
  lastUpdatedAt: Date;
}) {
  return {
    campaignId: campaign.campaignId,
    label: 'Possible campaign requiring review',
    status: campaign.status,
    confidence: campaign.confidence ?? null,
    confidenceLevel: campaign.confidenceLevel ?? 'LOW',
    summary: campaign.summary ?? 'Reports share indicators and require human review.',
    reportCount: campaign.reportIds.length,
    indicatorCount: campaign.indicatorIds.length,
    evidence: mapEvidence(campaign.evidence),
    firstDetectedAt: campaign.firstDetectedAt,
    lastUpdatedAt: campaign.lastUpdatedAt,
  };
}

export async function listCampaignThreatIntelligence(input: unknown) {
  const { page, limit, status } = parseListQuery(input);
  const filter = status ? { status } : {};
  try {
    const [items, total] = await Promise.all([
      Campaign.find(filter)
        .select({ _id: 0, campaignId: 1, status: 1, confidence: 1, confidenceLevel: 1, summary: 1, reportIds: 1, indicatorIds: 1, evidence: 1, firstDetectedAt: 1, lastUpdatedAt: 1 })
        .sort({ lastUpdatedAt: -1, campaignId: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      Campaign.countDocuments(filter).exec(),
    ]);
    return {
      items: items.map((campaign) => mapCampaignSummary(campaign)),
      pagination: { page, limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / limit) },
    };
  } catch {
    throw new AppError('Database unavailable', 503);
  }
}

export async function getCampaignThreatIntelligence(campaignId: string) {
  if (!/^PC-\d{4}-\d{5}$/u.test(campaignId)) throw new AppError('Invalid campaign ID', 400);
  try {
    const campaign = await Campaign.findOne({ campaignId })
      .select({ _id: 0, campaignId: 1, status: 1, confidence: 1, confidenceLevel: 1, summary: 1, reportIds: 1, indicatorIds: 1, evidence: 1, firstDetectedAt: 1, lastUpdatedAt: 1 })
      .lean()
      .exec();
    if (!campaign) throw new AppError('Campaign not found', 404);
    const [reports, indicators] = await Promise.all([
      Report.find({ _id: { $in: campaign.reportIds } })
        .select({ _id: 0, referenceId: 1, category: 1, reportedAt: 1 })
        .sort({ reportedAt: -1 })
        .limit(100)
        .lean()
        .exec(),
      ThreatIndicator.find({ _id: { $in: campaign.indicatorIds } })
        .select({ _id: 0, type: 1, normalizedValue: 1, firstSeen: 1, lastSeen: 1, confidence: 1 })
        .sort({ type: 1, normalizedValue: 1 })
        .limit(50)
        .lean()
        .exec(),
    ]);
    return {
      ...mapCampaignSummary(campaign),
      indicators: indicators.map((indicator) => ({
        type: indicator.type,
        value: safeIndicatorValue(indicator.type, indicator.normalizedValue),
        firstSeen: indicator.firstSeen,
        lastSeen: indicator.lastSeen,
        confidence: indicator.confidence ?? null,
      })),
      relatedReports: reports.map((report) => ({
        referenceId: report.referenceId,
        ...(report.category ? { category: report.category } : {}),
        reportedAt: report.reportedAt,
      })),
      reviewRequired: true,
      attributionEstablished: false,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Database unavailable', 503);
  }
}
