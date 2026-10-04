import { createHash, randomInt } from 'node:crypto';
import mongoose from 'mongoose';
import { AuditEvent } from '../../models/AuditEvent.js';
import { Campaign, type CampaignConfidenceLevel, type CampaignEvidence, type CampaignDocument } from '../../models/Campaign.js';
import { Report, type ReportCategory, type ReportCorrelationReason } from '../../models/Report.js';
import { ThreatIndicator, type ThreatIndicatorType } from '../../models/ThreatIndicator.js';
import type { AnalysisResult } from '../../types/analysis.js';
import { ReportCorrelationService } from './ReportCorrelationService.js';

const MAX_CLUSTER_REPORTS = 100;
const MAX_CAMPAIGN_EVIDENCE = 50;
const CAMPAIGN_MIN_REPORTS = 2;

interface ReportNode {
  _id: mongoose.Types.ObjectId;
  referenceId: string;
  category?: ReportCategory;
  reportedAt: Date;
  relatedReports: Array<{
    reportId: mongoose.Types.ObjectId;
    level: string;
    score: number;
    reasons: ReportCorrelationReason[];
  }>;
}

interface EvidenceAggregate {
  reason: ReportCorrelationReason;
  reportIds: Set<string>;
}

interface CampaignProposal {
  reports: ReportNode[];
  evidence: CampaignEvidence[];
  indicatorIds: mongoose.Types.ObjectId[];
  confidence: number;
  confidenceLevel: CampaignConfidenceLevel;
  category?: ReportCategory;
  fingerprint: string;
  summary: string;
}

export interface CampaignDetectionOutcome {
  correlation: Awaited<ReturnType<ReportCorrelationService['processAnalysis']>>;
  possibleCampaign: {
    campaignId: string;
    created: boolean;
    confidence: number;
    confidenceLevel: CampaignConfidenceLevel;
    reportCount: number;
  } | null;
}

function indicatorKey(type: string, value: string): string {
  return `${type}:${value.toLowerCase()}`;
}

function maskedValue(type: string, value: string): string {
  if (type === 'DOMAIN') return value;
  if (type === 'URL') {
    try { return new URL(value).hostname.toLowerCase(); } catch { return '[URL withheld]'; }
  }
  if (type === 'PHONE') return `••••••${value.replace(/\D/gu, '').slice(-2)}`;
  if (type === 'EMAIL' || type === 'UPI_ID') {
    const [name = '', suffix = ''] = value.split('@');
    return `${name.slice(0, 1)}***@${suffix}`;
  }
  return '[phrase text withheld]';
}

function independentSignalKey(reason: ReportCorrelationReason): string {
  if (reason.indicatorType === 'URL') {
    try { return `HOST:${new URL(reason.value).hostname.toLowerCase()}`; } catch { /* fall through to the exact value */ }
  }
  if (reason.indicatorType === 'DOMAIN') return `HOST:${reason.value.toLowerCase()}`;
  return indicatorKey(reason.indicatorType, reason.value);
}

function isHighIndicator(type: string): boolean {
  return ['URL', 'DOMAIN', 'PHONE', 'EMAIL', 'UPI_ID'].includes(type);
}

function confidenceFor(
  reports: ReportNode[],
  evidence: EvidenceAggregate[],
  pairScores: number[],
): { confidence: number; level: CampaignConfidenceLevel; category?: ReportCategory } {
  const highSignals = new Map<string, string>();
  const highTypes = new Set<string>();
  const hasUniqueStrongIndicator = evidence.some(({ reason }) =>
    ['URL', 'PHONE', 'EMAIL', 'UPI_ID'].includes(reason.indicatorType),
  );
  let hasDistinctivePhrase = false;
  for (const item of evidence) {
    if (isHighIndicator(item.reason.indicatorType)) {
      highSignals.set(independentSignalKey(item.reason), item.reason.indicatorType);
      highTypes.add(item.reason.indicatorType);
    } else if (item.reason.indicatorType === 'PHRASE' && item.reason.weight >= 0.1) {
      hasDistinctivePhrase = true;
    }
  }

  const reportCount = reports.length;
  const hasThreeReportSignal = reportCount >= 3 && highSignals.size >= 1;
  const hasMultipleHighSignals = highSignals.size >= 2;
  const hasPhraseSupport = highSignals.size >= 1 && hasDistinctivePhrase;
  const qualifies = reportCount >= CAMPAIGN_MIN_REPORTS && (
    hasUniqueStrongIndicator || hasMultipleHighSignals || hasThreeReportSignal || hasPhraseSupport
  );
  if (!qualifies) return { confidence: 0, level: 'LOW' };

  const categoryCounts = new Map<ReportCategory, number>();
  for (const report of reports) if (report.category) categoryCounts.set(report.category, (categoryCounts.get(report.category) ?? 0) + 1);
  const commonCategory = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const categoryConsistency = commonCategory ? commonCategory[1] / reportCount : 0;
  const category = commonCategory && categoryConsistency >= 0.6 ? commonCategory[0] : undefined;
  const times = reports.map(({ reportedAt }) => new Date(reportedAt).getTime()).filter(Number.isFinite);
  const temporalRangeDays = times.length > 1 ? (Math.max(...times) - Math.min(...times)) / 86_400_000 : Infinity;
  const temporalScore = temporalRangeDays <= 7 ? 0.04 : temporalRangeDays <= 30 ? 0.02 : 0;
  const meanPairScore = pairScores.length ? pairScores.reduce((sum, score) => sum + score, 0) / pairScores.length : 0;
  const countScore = Math.min(0.3, 0.15 + Math.max(0, reportCount - 2) * 0.05);
  const signalScore = Math.min(0.3, highSignals.size * 0.12);
  const diversityScore = Math.min(0.08, highTypes.size * 0.08 / 3);
  const confidence = Number(Math.min(0.95, 0.2 + countScore + signalScore + diversityScore
    + meanPairScore * 0.12 + categoryConsistency * 0.04 + temporalScore).toFixed(3));
  const level: CampaignConfidenceLevel = confidence >= 0.75 ? 'HIGH' : confidence >= 0.5 ? 'MEDIUM' : 'LOW';
  return { confidence, level, ...(category ? { category } : {}) };
}

function makeCampaignId(): string {
  return `PC-${new Date().getUTCFullYear()}-${randomInt(0, 100_000).toString().padStart(5, '0')}`;
}

export class CampaignDetectionService {
  constructor(private readonly correlation = new ReportCorrelationService()) {}

  async processAnalysis(reportId: string, analysis: AnalysisResult): Promise<CampaignDetectionOutcome> {
    const correlation = await this.correlation.processAnalysis(reportId, analysis);
    const possibleCampaign = await this.detectForReport(reportId);
    return { correlation, possibleCampaign };
  }

  async detectForReport(reportId: string): Promise<CampaignDetectionOutcome['possibleCampaign']> {
    const rootId = new mongoose.Types.ObjectId(reportId);
    const reports = await this.loadRelatedComponent(rootId);
    if (reports.length < CAMPAIGN_MIN_REPORTS) return null;

    const reportById = new Map(reports.map((report) => [report._id.toString(), report]));
    const evidenceMap = new Map<string, EvidenceAggregate>();
    const edgeScores = new Map<string, number>();
    for (const report of reports) {
      const sourceId = report._id.toString();
      for (const relation of report.relatedReports ?? []) {
        const targetId = relation.reportId.toString();
        if (!reportById.has(targetId) || targetId === sourceId) continue;
        if (!['STRONG_RELATION', 'MODERATE_RELATION'].includes(relation.level)) continue;
        const pairKey = [sourceId, targetId].sort().join(':');
        edgeScores.set(pairKey, Math.max(edgeScores.get(pairKey) ?? 0, relation.score));
        for (const reason of relation.reasons) {
          const key = indicatorKey(reason.indicatorType, reason.value);
          const aggregate = evidenceMap.get(key) ?? { reason, reportIds: new Set<string>() };
          aggregate.reportIds.add(sourceId);
          aggregate.reportIds.add(targetId);
          if (reason.weight > aggregate.reason.weight) aggregate.reason = reason;
          evidenceMap.set(key, aggregate);
        }
      }
    }
    const evidenceAggregates = [...evidenceMap.values()];
    const reportNodes = reports;
    const confidence = confidenceFor(reportNodes, evidenceAggregates, [...edgeScores.values()]);
    if (confidence.confidence === 0) return null;

    const indicatorClauses = evidenceAggregates.map(({ reason }) => ({ type: reason.indicatorType as ThreatIndicatorType, normalizedValue: reason.value }));
    const indicatorRecords = await ThreatIndicator.find({ $or: indicatorClauses })
      .select({ _id: 1, type: 1, normalizedValue: 1 })
      .lean()
      .exec();
    const indicatorByKey = new Map(indicatorRecords.map((indicator) => [indicatorKey(indicator.type, indicator.normalizedValue), indicator._id]));
    const evidence: CampaignEvidence[] = evidenceAggregates.flatMap(({ reason, reportIds }) => {
      const indicatorId = indicatorByKey.get(indicatorKey(reason.indicatorType, reason.value));
      if (!indicatorId) return [];
      return [{
        type: reason.type,
        indicatorType: reason.indicatorType,
        indicatorId,
        displayValue: maskedValue(reason.indicatorType, reason.value),
        weight: reason.weight,
        explanation: reason.explanation,
        supportingReportIds: [...reportIds].map((id) => new mongoose.Types.ObjectId(id)),
      }];
    }).slice(0, MAX_CAMPAIGN_EVIDENCE);
    const indicatorIds = [...new Set(evidence.map(({ indicatorId }) => indicatorId.toString()))]
      .map((id) => new mongoose.Types.ObjectId(id));
    if (!evidence.length || !indicatorIds.length) return null;

    const highEvidenceForFingerprint = evidenceAggregates
      .filter(({ reason }) => isHighIndicator(reason.indicatorType))
      .map(({ reason }) => `${reason.indicatorType}:${reason.value}`)
      .sort();
    const fingerprint = createHash('sha256').update(highEvidenceForFingerprint.join('\n')).digest('hex');
    const campaignReports = reports.map(({ _id }) => _id);
    const summary = `Possible campaign requiring review. The system identified ${reports.length} related reports sharing ${indicatorIds.length} normalized indicators. This hypothesis does not establish attribution.`;
    const proposal: CampaignProposal = {
      reports,
      evidence,
      indicatorIds,
      confidence: confidence.confidence,
      confidenceLevel: confidence.level,
      ...(confidence.category ? { category: confidence.category } : {}),
      fingerprint,
      summary,
    };
    return this.upsertCampaign(proposal, campaignReports);
  }

  private async loadRelatedComponent(rootId: mongoose.Types.ObjectId): Promise<ReportNode[]> {
    const found = new Map<string, ReportNode>();
    const pending: mongoose.Types.ObjectId[] = [rootId];
    while (pending.length && found.size < MAX_CLUSTER_REPORTS) {
      const batch = pending.splice(0, 50).filter((id) => !found.has(id.toString()));
      if (!batch.length) continue;
      const nodes = await Report.find({ _id: { $in: batch } })
        .select({ _id: 1, referenceId: 1, category: 1, reportedAt: 1, relatedReports: 1 })
        .limit(MAX_CLUSTER_REPORTS)
        .lean<ReportNode[]>()
        .exec();
      for (const node of nodes) {
        const id = node._id.toString();
        if (found.has(id)) continue;
        found.set(id, node);
        for (const relation of node.relatedReports ?? []) {
          if (!found.has(relation.reportId.toString()) && pending.length + found.size < MAX_CLUSTER_REPORTS) pending.push(relation.reportId);
        }
      }
    }
    return [...found.values()];
  }

  private async upsertCampaign(
    proposal: CampaignProposal,
    reportIds: mongoose.Types.ObjectId[],
  ): Promise<NonNullable<CampaignDetectionOutcome['possibleCampaign']>> {
    const fingerprintMatch = await Campaign.findOne({ clusterFingerprint: proposal.fingerprint }).exec();
    let existing = fingerprintMatch;
    if (!existing) {
      const overlapping = await Campaign.find({ reportIds: { $in: reportIds } })
        .sort({ lastUpdatedAt: -1 })
        .limit(20)
        .exec();
      const reportSet = new Set(reportIds.map((id) => id.toString()));
      existing = overlapping
        .map((campaign) => ({ campaign, overlap: campaign.reportIds.filter((id) => reportSet.has(id.toString())).length }))
        .filter(({ overlap }) => overlap >= 2)
        .sort((left, right) => right.overlap - left.overlap)[0]?.campaign ?? null;
    }

    const now = new Date();
    let campaign: CampaignDocument;
    let created = false;
    if (existing) {
      const previousReports = new Set(existing.reportIds.map((id) => id.toString()));
      const previousIndicators = new Set(existing.indicatorIds.map((id) => id.toString()));
      existing.reportIds = [...new Set([...existing.reportIds, ...reportIds].map((id) => id.toString()))]
        .map((id) => new mongoose.Types.ObjectId(id));
      existing.indicatorIds = [...new Set([...existing.indicatorIds, ...proposal.indicatorIds].map((id) => id.toString()))]
        .map((id) => new mongoose.Types.ObjectId(id));
      existing.confidence = proposal.confidence;
      existing.confidenceLevel = proposal.confidenceLevel;
      existing.evidence = proposal.evidence;
      existing.summary = proposal.summary;
      existing.clusterFingerprint = proposal.fingerprint;
      if (proposal.category) existing.category = proposal.category;
      existing.lastUpdatedAt = now;
      campaign = await existing.save();

      const newReportIds = campaign.reportIds.filter((id) => !previousReports.has(id.toString()));
      const newIndicatorIds = campaign.indicatorIds.filter((id) => !previousIndicators.has(id.toString()));
      await this.linkReportsAndAudit(campaign, newReportIds, newIndicatorIds, 'CAMPAIGN_UPDATED');
    } else {
      let lastError: unknown;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          campaign = await Campaign.create({
            campaignId: makeCampaignId(),
            clusterFingerprint: proposal.fingerprint,
            name: 'Possible campaign requiring review',
            ...(proposal.category ? { category: proposal.category } : {}),
            status: 'UNDER_REVIEW',
            reportIds,
            indicatorIds: proposal.indicatorIds,
            confidence: proposal.confidence,
            confidenceLevel: proposal.confidenceLevel,
            evidence: proposal.evidence,
            summary: proposal.summary,
            firstDetectedAt: now,
            lastUpdatedAt: now,
          });
          created = true;
          break;
        } catch (error) {
          lastError = error;
          const duplicate = typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
          if (!duplicate) throw error;
          const byFingerprint = await Campaign.findOne({ clusterFingerprint: proposal.fingerprint }).exec();
          if (byFingerprint) {
            existing = byFingerprint;
            attempt = 4;
          }
        }
      }
      if (!created) {
        if (!existing) throw lastError ?? new Error('Unable to create campaign.');
        const previousReports = new Set(existing.reportIds.map((id) => id.toString()));
        const previousIndicators = new Set(existing.indicatorIds.map((id) => id.toString()));
        existing.reportIds = [...new Set([...existing.reportIds, ...reportIds].map((id) => id.toString()))].map((id) => new mongoose.Types.ObjectId(id));
        existing.indicatorIds = [...new Set([...existing.indicatorIds, ...proposal.indicatorIds].map((id) => id.toString()))].map((id) => new mongoose.Types.ObjectId(id));
        existing.confidence = proposal.confidence;
        existing.confidenceLevel = proposal.confidenceLevel;
        existing.evidence = proposal.evidence;
        existing.summary = proposal.summary;
        existing.clusterFingerprint = proposal.fingerprint;
        existing.lastUpdatedAt = now;
        if (proposal.category) existing.category = proposal.category;
        campaign = await existing.save();
        const newReportIds = campaign.reportIds.filter((id) => !previousReports.has(id.toString()));
        const newIndicatorIds = campaign.indicatorIds.filter((id) => !previousIndicators.has(id.toString()));
        await this.linkReportsAndAudit(campaign, newReportIds, newIndicatorIds, 'CAMPAIGN_UPDATED');
      } else {
        await this.linkReportsAndAudit(campaign!, reportIds, proposal.indicatorIds, 'CAMPAIGN_CREATED');
      }
    }

    return {
      campaignId: campaign!.campaignId,
      created,
      confidence: campaign!.confidence ?? proposal.confidence,
      confidenceLevel: campaign!.confidenceLevel ?? proposal.confidenceLevel,
      reportCount: campaign!.reportIds.length,
    };
  }

  private async linkReportsAndAudit(
    campaign: CampaignDocument,
    reportIds: mongoose.Types.ObjectId[],
    indicatorIds: mongoose.Types.ObjectId[],
    campaignAction: 'CAMPAIGN_CREATED' | 'CAMPAIGN_UPDATED',
  ): Promise<void> {
    const now = new Date();
    const auditRows: Array<Record<string, unknown>> = [{
      entityType: 'CAMPAIGN', entityId: campaign._id, action: campaignAction, actorType: 'SYSTEM', timestamp: now,
      metadata: { reason: campaignAction === 'CAMPAIGN_CREATED' ? 'Possible campaign detected from shared report indicators; human review required.' : 'Possible campaign evidence or membership refreshed; no attribution is implied.' },
    }];
    for (const reportId of reportIds) {
      await Report.updateOne({ _id: reportId }, { $addToSet: { campaignIds: campaign._id } }).exec();
      auditRows.push({ entityType: 'REPORT', entityId: reportId, action: 'REPORT_LINKED_TO_CAMPAIGN', actorType: 'SYSTEM', timestamp: now, metadata: { reason: 'Report linked to a possible campaign based on shared indicator evidence.' } });
    }
    for (const indicatorId of indicatorIds) {
      auditRows.push({ entityType: 'INDICATOR', entityId: indicatorId, action: 'INDICATOR_LINKED_TO_CAMPAIGN', actorType: 'SYSTEM', timestamp: now, metadata: { reason: 'Indicator included as explainable evidence for a possible campaign.' } });
    }
    await AuditEvent.insertMany(auditRows, { ordered: true });
  }
}
