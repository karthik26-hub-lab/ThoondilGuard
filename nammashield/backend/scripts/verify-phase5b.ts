import assert from 'node:assert/strict';
import express from 'express';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { AuditEvent } from '../src/models/AuditEvent.js';
import { Campaign } from '../src/models/Campaign.js';
import { Report } from '../src/models/Report.js';
import { ThreatIndicator } from '../src/models/ThreatIndicator.js';
import { CampaignDetectionService } from '../src/services/correlation/CampaignDetectionService.js';
import type { AnalysisResult, NormalizedAnalysisIndicator } from '../src/types/analysis.js';
import { createInternalThreatIntelligenceRouter } from '../src/routes/internalThreatIntelligence.routes.js';

const makeIndicator = (type: NormalizedAnalysisIndicator['type'], value: string): NormalizedAnalysisIndicator => ({
  type,
  value,
  normalizedValue: value,
  confidence: 0.92,
  source: type === 'URL' || type === 'DOMAIN' ? 'url' : 'rule',
  evidence: `Synthetic ${type} evidence fixture.`,
});

const makeResult = (indicators: NormalizedAnalysisIndicator[]): AnalysisResult => ({
  riskLevel: 'NEEDS_VERIFICATION', category: null,
  summary: 'Synthetic test assessment.', uncertainty: 'Synthetic test data; human review is required.', requestedAction: null,
  reasons: [], evidence: [], confidence: 0.5, indicators, urls: [], providersUsed: [],
  providerAssessments: [], warnings: [], analyzerVersion: 'phase5b-test', analyzedAt: new Date(),
});

async function createReport(label: string, category: 'bank_impersonation' | 'delivery_scam', indicators: NormalizedAnalysisIndicator[]) {
  const report = await Report.create({
    referenceId: `TG-P5B-${Date.now()}-${label}-${Math.floor(Math.random() * 100_000)}`,
    inputType: 'text', source: 'web', category, content: `PRIVATE CITIZEN CONTENT FIXTURE ${label}`,
  });
  return { report, result: makeResult(indicators) };
}

async function withHttpApp<T>(work: (baseUrl: string) => Promise<T>): Promise<T> {
  const app = express();
  const testToken = 'phase5b-test-only-token-0123456789abcdef';
  app.use('/internal/threat-intelligence/campaigns', createInternalThreatIntelligenceRouter(testToken));
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test HTTP server did not bind to a TCP port.');
  try {
    return await work(`http://127.0.0.1:${address.port}/internal/threat-intelligence/campaigns`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function verify(): Promise<void> {
  if (!env.mongodbUri) throw new Error('MONGODB_URI is not configured.');
  const dbName = `p5b_${Date.now().toString(36)}_${Math.floor(Math.random() * 1_000_000).toString(36)}`;
  let connected = false;
  try {
    await mongoose.connect(env.mongodbUri, { dbName, autoIndex: true, serverSelectionTimeoutMS: 10_000 });
    connected = true;
    await Promise.all([Report.init(), ThreatIndicator.init(), Campaign.init(), AuditEvent.init()]);
    const detector = new CampaignDetectionService();
    const domainX = makeIndicator('DOMAIN', 'cluster-x.example.test');
    const phoneY = makeIndicator('PHONE', '+14155550111');
    const a = await createReport('A', 'bank_impersonation', [domainX, phoneY]);
    const b = await createReport('B', 'bank_impersonation', [domainX, phoneY]);
    assert.equal((await detector.processAnalysis(a.report.id, a.result)).possibleCampaign, null, 'isolated report cannot create a campaign');
    const firstDetection = await detector.processAnalysis(b.report.id, b.result);
    assert.ok(firstDetection.possibleCampaign);
    const campaignId = firstDetection.possibleCampaign.campaignId;
    assert.equal(firstDetection.possibleCampaign.created, true);
    const campaignAfterTwo = await Campaign.findOne({ campaignId }).lean().exec();
    assert.ok(campaignAfterTwo);
    assert.equal(campaignAfterTwo.status, 'UNDER_REVIEW');
    assert.ok((campaignAfterTwo.confidence ?? 0) >= 0.5);
    assert.ok(campaignAfterTwo.evidence.some(({ type }) => type === 'SHARED_DOMAIN'));
    assert.ok(campaignAfterTwo.evidence.some(({ type }) => type === 'SHARED_PHONE'));

    const c = await createReport('C', 'bank_impersonation', [
      domainX,
      makeIndicator('PHRASE', 'share your verification code immediately'),
    ]);
    const thirdDetection = await detector.processAnalysis(c.report.id, c.result);
    assert.equal(thirdDetection.possibleCampaign?.campaignId, campaignId, 'an additional related report updates the existing campaign');
    assert.equal(thirdDetection.possibleCampaign?.created, false);
    const firstDetectedAt = campaignAfterTwo.firstDetectedAt.toISOString();
    const sameClusterAgain = await detector.processAnalysis(b.report.id, b.result);
    assert.equal(sameClusterAgain.possibleCampaign?.campaignId, campaignId, 'reprocessing must reuse the campaign');
    const campaignAfterRepeat = await Campaign.findOne({ campaignId }).lean().exec();
    assert.equal(campaignAfterRepeat?.firstDetectedAt.toISOString(), firstDetectedAt);
    assert.deepEqual(new Set(campaignAfterRepeat?.reportIds.map(String)), new Set([a.report.id, b.report.id, c.report.id]));

    const unrelated = await createReport('D', 'delivery_scam', [
      makeIndicator('DOMAIN', 'unrelated.example.invalid'), makeIndicator('PHONE', '+442079460002'),
      makeIndicator('EMAIL', 'different@unrelated.example.invalid'), makeIndicator('UPI_ID', 'other@okaxis'),
    ]);
    assert.equal((await detector.processAnalysis(unrelated.report.id, unrelated.result)).possibleCampaign, null);
    const categoryOnlyA = await createReport('E', 'delivery_scam', []);
    const categoryOnlyB = await createReport('F', 'delivery_scam', []);
    await detector.processAnalysis(categoryOnlyA.report.id, categoryOnlyA.result);
    assert.equal((await detector.processAnalysis(categoryOnlyB.report.id, categoryOnlyB.result)).possibleCampaign, null);
    const genericA = await createReport('G', 'delivery_scam', [
      makeIndicator('PHRASE', 'your otp is required'), makeIndicator('DOMAIN', 'generic-a.example.test'),
    ]);
    const genericB = await createReport('H', 'delivery_scam', [
      makeIndicator('PHRASE', 'your otp is required'), makeIndicator('DOMAIN', 'generic-b.example.test'),
    ]);
    await detector.processAnalysis(genericA.report.id, genericA.result);
    assert.equal((await detector.processAnalysis(genericB.report.id, genericB.result)).possibleCampaign, null);

    const pathA = await createReport('I', 'delivery_scam', [
      makeIndicator('URL', 'https://delivery-cluster.example.test/login'),
      makeIndicator('DOMAIN', 'delivery-cluster.example.test'),
      makeIndicator('PHRASE', 'verify your wallet immediately'),
    ]);
    const pathB = await createReport('J', 'delivery_scam', [
      makeIndicator('URL', 'https://delivery-cluster.example.test/confirm'),
      makeIndicator('DOMAIN', 'delivery-cluster.example.test'),
      makeIndicator('PHRASE', 'verify your wallet immediately'),
    ]);
    await detector.processAnalysis(pathA.report.id, pathA.result);
    const pathCampaignResult = await detector.processAnalysis(pathB.report.id, pathB.result);
    assert.ok(pathCampaignResult.possibleCampaign, 'shared domain and distinctive scam structure can qualify despite different paths');
    const pathCampaign = await Campaign.findOne({ campaignId: pathCampaignResult.possibleCampaign.campaignId }).lean().exec();
    assert.ok(pathCampaign?.evidence.some(({ indicatorType }) => indicatorType === 'PHRASE'));

    const campaignCount = await Campaign.countDocuments().exec();
    assert.equal(campaignCount, 2, 'unrelated, category-only, and generic-phrase reports stay outside campaigns');
    const linked = await Report.find({ _id: { $in: [a.report._id, b.report._id, c.report._id] } })
      .select({ status: 1, campaignIds: 1, caseIds: 1 }).lean().exec();
    assert.ok(linked.every(({ status, campaignIds, caseIds }) => status === 'NEW' && campaignIds.length === 1 && caseIds.length === 0));
    assert.ok((await Report.findById(unrelated.report._id).lean().exec())?.campaignIds.length === 0);
    assert.ok(await AuditEvent.exists({ action: 'CAMPAIGN_CREATED', actorType: 'SYSTEM' }));
    assert.ok(await AuditEvent.exists({ action: 'CAMPAIGN_UPDATED', actorType: 'SYSTEM' }));
    assert.ok(await AuditEvent.exists({ action: 'REPORT_LINKED_TO_CAMPAIGN', actorType: 'SYSTEM' }));
    assert.ok(await AuditEvent.exists({ action: 'INDICATOR_LINKED_TO_CAMPAIGN', actorType: 'SYSTEM' }));

    const routeToken = 'phase5b-test-only-token-0123456789abcdef';
    await withHttpApp(async (baseUrl) => {
      const auth = { authorization: `Bearer ${routeToken}` };
      const pageResponse = await fetch(`${baseUrl}?page=1&limit=1`, { headers: auth });
      assert.equal(pageResponse.status, 200);
      const pageBody = await pageResponse.json() as { data: { items: Array<{ campaignId: string }>; pagination: { total: number; totalPages: number } } };
      assert.equal(pageBody.data.items.length, 1);
      assert.equal(pageBody.data.pagination.total, 2);
      assert.equal(pageBody.data.pagination.totalPages, 2);
      const invalidPage = await fetch(`${baseUrl}?page=0`, { headers: auth });
      assert.equal(invalidPage.status, 400);
      const invalidId = await fetch(`${baseUrl}/not-a-campaign`, { headers: auth });
      assert.equal(invalidId.status, 400);
      const unknown = await fetch(`${baseUrl}/PC-2025-99999`, { headers: auth });
      assert.equal(unknown.status, 404);
      const detail = await fetch(`${baseUrl}/${campaignId}`, { headers: auth });
      assert.equal(detail.status, 200);
      const detailText = await detail.text();
      assert.equal(detailText.includes('PRIVATE CITIZEN CONTENT FIXTURE'), false);
      assert.equal(detailText.includes('+14155550111'), false);
      assert.equal(detailText.includes('fraud@example'), false);
      const detailBody = JSON.parse(detailText) as { data: { reviewRequired: boolean; attributionEstablished: boolean; indicators: Array<{ value: string }> } };
      assert.equal(detailBody.data.reviewRequired, true);
      assert.equal(detailBody.data.attributionEstablished, false);
      assert.ok(detailBody.data.indicators.some(({ value }) => value.startsWith('••••')));
      const unauthorized = await fetch(baseUrl);
      assert.equal(unauthorized.status, 401);
    });

    const disabled = await withHttpApp(async (baseUrl) => {
      const app = express();
      app.use('/internal/threat-intelligence/campaigns', createInternalThreatIntelligenceRouter(undefined));
      app.use(errorHandler);
      const server = app.listen(0, '127.0.0.1');
      await new Promise<void>((resolve) => server.once('listening', resolve));
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Test server bind failed.');
      try { return (await fetch(`http://127.0.0.1:${address.port}/internal/threat-intelligence/campaigns`)).status; }
      finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
    });
    assert.equal(disabled, 503);
  } finally {
    if (connected) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  }
}

await verify();
console.log(JSON.stringify({
  campaignDetection: 'PASS',
  confidenceAndEvidence: 'PASS',
  unrelatedReportSeparation: 'PASS',
  deduplicationAndUpdate: 'PASS',
  auditTrail: 'PASS',
  apiAuthenticationPrivacyPagination: 'PASS',
  temporaryDatabaseCleaned: true,
  status: 'PASS',
}, null, 2));
