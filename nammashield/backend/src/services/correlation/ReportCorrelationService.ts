import mongoose from 'mongoose';
import { AuditEvent } from '../../models/AuditEvent.js';
import { Report, type RelatedReport } from '../../models/Report.js';
import { ThreatIndicator } from '../../models/ThreatIndicator.js';
import type { AnalysisResult, NormalizedAnalysisIndicator } from '../../types/analysis.js';
import { IndicatorPersistenceService } from './IndicatorPersistenceService.js';
import { SimilarityEngine, type SimilarityResult } from './SimilarityEngine.js';

const MAX_CANDIDATE_REPORTS = 500;

export interface RelatedReportMatch extends SimilarityResult {
  reportId: string;
  referenceId: string;
}

export interface ReportCorrelationResult {
  reportId: string;
  persistedIndicatorCount: number;
  matches: RelatedReportMatch[];
}

export class ReportCorrelationService {
  constructor(
    private readonly indicatorPersistence = new IndicatorPersistenceService(),
    private readonly similarity = new SimilarityEngine(),
  ) {}

  /** Persists an existing Phase 4D result and correlates by its normalized indicators. */
  async processAnalysis(reportId: string, result: AnalysisResult): Promise<ReportCorrelationResult> {
    const id = new mongoose.Types.ObjectId(reportId);
    const report = await Report.findById(id).exec();
    if (!report) throw new Error('Report not found.');

    report.riskLevel = result.riskLevel;
    report.analysis = {
      summary: result.summary,
      reasons: result.reasons.map(({ message }) => message).slice(0, 20),
      reasonDetails: result.reasons.slice(0, 20),
      evidence: result.evidence.slice(0, 50),
      indicators: result.indicators.slice(0, 100),
      providerAssessments: result.providerAssessments.slice(0, 10),
      warnings: result.warnings.slice(0, 10),
      confidence: result.confidence,
      uncertainty: result.uncertainty,
      requestedAction: result.requestedAction,
      suspectedCategory: result.category,
      analyzedAt: result.analyzedAt,
      analyzerVersion: result.analyzerVersion,
    };
    await report.save();

    const persisted = await this.indicatorPersistence.persist(id, result.indicators);
    const matches = await this.findMatches(id, persisted.indicators);
    const storedMatches = matches.filter(({ related, level }) =>
      related && (level === 'STRONG_RELATION' || level === 'MODERATE_RELATION'),
    );

    for (const match of storedMatches) {
      const otherId = new mongoose.Types.ObjectId(match.reportId);
      const now = new Date();
      const forward: RelatedReport = {
        reportId: otherId,
        level: match.level as RelatedReport['level'],
        score: match.score,
        reasons: match.reasons,
        correlatedAt: now,
      };
      const reverse: RelatedReport = {
        reportId: id,
        level: match.level as RelatedReport['level'],
        score: match.score,
        reasons: match.reasons,
        correlatedAt: now,
      };
      const [createdForward, createdReverse] = await Promise.all([
        this.upsertRelationship(id, forward),
        this.upsertRelationship(otherId, reverse),
      ]);
      const auditRows = [
        ...(createdForward ? [{ entityType: 'REPORT' as const, entityId: id, action: 'REPORT_CORRELATED', actorType: 'SYSTEM' as const, metadata: { reason: 'Deterministic shared-indicator evidence; no campaign or attribution is implied.' }, timestamp: now }] : []),
        ...(createdReverse ? [{ entityType: 'REPORT' as const, entityId: otherId, action: 'REPORT_CORRELATED', actorType: 'SYSTEM' as const, metadata: { reason: 'Deterministic shared-indicator evidence; no campaign or attribution is implied.' }, timestamp: now }] : []),
      ];
      if (auditRows.length) await AuditEvent.insertMany(auditRows, { ordered: true });
    }

    return { reportId: id.toString(), persistedIndicatorCount: persisted.indicatorIds.length, matches };
  }

  private async upsertRelationship(reportId: mongoose.Types.ObjectId, value: RelatedReport): Promise<boolean> {
    const updated = await Report.updateOne(
      { _id: reportId, 'relatedReports.reportId': value.reportId },
      { $set: { 'relatedReports.$': value } },
    ).exec();
    if (updated.matchedCount) return false;

    const inserted = await Report.updateOne(
      { _id: reportId, relatedReports: { $not: { $elemMatch: { reportId: value.reportId } } } },
      { $push: { relatedReports: value } },
    ).exec();
    return inserted.modifiedCount > 0;
  }

  private async findMatches(
    currentReportId: mongoose.Types.ObjectId,
    indicators: readonly NormalizedAnalysisIndicator[],
  ): Promise<RelatedReportMatch[]> {
    if (!indicators.length) return [];
    const indicatorQuery = indicators.map(({ type, normalizedValue }) => ({ type, normalizedValue }));
    const sharedRecords = await ThreatIndicator.find({ $or: indicatorQuery })
      .select({ type: 1, normalizedValue: 1, value: 1, evidence: 1, confidence: 1, reportIds: { $slice: -MAX_CANDIDATE_REPORTS } })
      .lean()
      .exec();
    const sharedByReport = new Map<string, NormalizedAnalysisIndicator[]>();
    for (const record of sharedRecords) {
      for (const linkedReportId of record.reportIds) {
        const linkedId = linkedReportId.toString();
        if (linkedId === currentReportId.toString()) continue;
        const group = sharedByReport.get(linkedId) ?? [];
        group.push({
          type: record.type,
          value: record.value,
          normalizedValue: record.normalizedValue,
          confidence: record.confidence ?? 0.5,
          source: 'rule',
          evidence: record.evidence ?? 'Shared normalized indicator stored for both reports.',
        });
        sharedByReport.set(linkedId, group);
      }
    }
    if (!sharedByReport.size) return [];

    const candidates = await Report.find({ _id: { $in: [...sharedByReport.keys()] } })
      .select({ _id: 1, referenceId: 1 })
      .limit(MAX_CANDIDATE_REPORTS)
      .lean()
      .exec();
    return candidates.flatMap((candidate) => {
      const comparison = this.similarity.compare(sharedByReport.get(candidate._id.toString()) ?? []);
      return [{ ...comparison, reportId: candidate._id.toString(), referenceId: candidate.referenceId }];
    }).sort((left, right) => right.score - left.score || left.referenceId.localeCompare(right.referenceId));
  }
}
