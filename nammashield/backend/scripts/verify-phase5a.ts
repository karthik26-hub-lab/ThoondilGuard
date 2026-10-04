import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { Report } from '../src/models/Report.js';
import { ThreatIndicator } from '../src/models/ThreatIndicator.js';
import type { AnalysisResult, NormalizedAnalysisIndicator } from '../src/types/analysis.js';
import { canonicalizeIndicator } from '../src/services/correlation/IndicatorPersistenceService.js';
import { SimilarityEngine } from '../src/services/correlation/SimilarityEngine.js';
import { ReportCorrelationService } from '../src/services/correlation/ReportCorrelationService.js';

const similarity = new SimilarityEngine();
const sample = (type: NormalizedAnalysisIndicator['type'], normalizedValue: string): NormalizedAnalysisIndicator => ({
  type,
  value: normalizedValue,
  normalizedValue,
  confidence: 0.9,
  evidence: `Synthetic ${type} fixture.`,
  source: 'rule',
});

assert.match(canonicalizeIndicator(sample('URL', 'https://EXAMPLE.test/login?campaign=spring&token=secret#fragment')) ?? '', /^https:\/\/example\.test\/login\?campaign=spring&token=%5Bredacted%5D$/u);
assert.equal((canonicalizeIndicator(sample('URL', 'https://EXAMPLE.test/login?token=secret#fragment')) ?? '').includes('secret'), false);
assert.equal(canonicalizeIndicator(sample('DOMAIN', 'Exämple.TEST.')), 'xn--exmple-cua.test');
assert.equal(canonicalizeIndicator(sample('PHONE', '+1 (415) 555-0100')), '+14155550100');
assert.equal(canonicalizeIndicator(sample('PHONE', '415-555-0100')), '4155550100');
assert.equal(canonicalizeIndicator(sample('EMAIL', ' User@Example.Test ')), 'user@example.test');
assert.equal(canonicalizeIndicator(sample('UPI_ID', ' Akash @ OKAxis ')), 'akash@okaxis');
assert.equal(canonicalizeIndicator(sample('PHRASE', ' Verify   your account ')), 'verify your account');

const exactUrl = similarity.compare([sample('URL', 'https://example.test/login')]);
assert.equal(exactUrl.level, 'STRONG_RELATION');
assert.equal(exactUrl.reasons[0]?.type, 'SHARED_URL');
assert.equal(similarity.compare([
  sample('URL', 'https://example.test/login'), sample('DOMAIN', 'example.test'),
]).score, 0.82, 'a URL and its derived host must not be counted as independent signals');
assert.equal(similarity.compare([sample('DOMAIN', 'example.test')]).related, true);
assert.equal(similarity.compare([sample('DOMAIN', 'example.test')]).reasons[0]?.type, 'SHARED_DOMAIN');
assert.equal(similarity.compare([sample('PHONE', '+14155550100')]).level, 'STRONG_RELATION');
assert.equal(similarity.compare([sample('UPI_ID', 'akash@okaxis')]).level, 'STRONG_RELATION');
assert.equal(similarity.compare([sample('EMAIL', 'fraud@example.test')]).level, 'STRONG_RELATION');
assert.equal(similarity.compare([sample('PHRASE', 'your otp is required')]).level, 'UNRELATED');
assert.equal(similarity.compare([]).level, 'UNRELATED');
const multi = similarity.compare([
  sample('DOMAIN', 'example.test'), sample('PHONE', '+14155550100'),
  sample('PHRASE', 'share your verification code immediately'),
]);
assert.equal(multi.level, 'STRONG_RELATION');
assert.deepEqual(new Set(multi.reasons.map(({ indicatorType }) => indicatorType)), new Set(['DOMAIN', 'PHONE', 'PHRASE']));
const duplicate = similarity.compare([sample('URL', 'https://example.test/login'), sample('URL', 'https://example.test/login')]);
assert.equal(duplicate.reasons.length, 1);

function result(indicators: NormalizedAnalysisIndicator[]): AnalysisResult {
  return {
    riskLevel: 'NEEDS_VERIFICATION', category: null,
    summary: 'Synthetic test result.', uncertainty: 'Synthetic fixture; no attribution.', requestedAction: null,
    reasons: [], evidence: [], confidence: 0.5, indicators, urls: [], providersUsed: [],
    providerAssessments: [], warnings: [], analyzerVersion: 'phase5a-test', analyzedAt: new Date(),
  };
}

async function verifyDatabaseIntegration(): Promise<void> {
  if (!env.mongodbUri) throw new Error('MONGODB_URI is not configured.');
  const dbName = `p5a_${Date.now().toString(36)}_${Math.floor(Math.random() * 1_000_000).toString(36)}`;
  let connected = false;
  try {
    await mongoose.connect(env.mongodbUri, { dbName, autoIndex: true, serverSelectionTimeoutMS: 10_000 });
    connected = true;
    await Promise.all([Report.init(), ThreatIndicator.init()]);
    const service = new ReportCorrelationService();
    const reports = await Report.create([
      { referenceId: `TG-P5A-${Date.now()}-A`, inputType: 'text', source: 'web', category: 'phishing', content: 'synthetic report A' },
      { referenceId: `TG-P5A-${Date.now()}-B`, inputType: 'text', source: 'web', category: 'phishing', content: 'synthetic report B' },
      { referenceId: `TG-P5A-${Date.now()}-C`, inputType: 'text', source: 'web', category: 'phishing', content: 'synthetic report C' },
    ]);
    const [a, b, c] = reports;
    assert.ok(a && b && c);
    const shared = [
      sample('URL', 'https://example.test/login'),
      sample('URL', 'https://EXAMPLE.test/login#fragment'),
      sample('URL', 'https://example.test/login'),
      sample('URL', 'https://sub.example.test/register'),
      sample('DOMAIN', 'example.test'),
      sample('DOMAIN', 'example.test'),
      sample('PHONE', '+1 (415) 555-0100'),
      sample('UPI_ID', 'fraud@okaxis'),
      sample('EMAIL', 'fraud@example.test'),
      sample('PHRASE', 'share your verification code immediately'),
    ];
    const aResult = await service.processAnalysis(a._id.toString(), result(shared));
    assert.equal(aResult.persistedIndicatorCount, 7, 'repeated URLs and domains in one report must each persist once');
    const aStored = await Report.findById(a._id).lean().exec();
    assert.equal(aStored?.indicators.length, 7, 'report must link to its deduplicated indicator records');
    await service.processAnalysis(b._id.toString(), result([
      sample('URL', 'https://example.test/verify'), sample('DOMAIN', 'example.test'), sample('PHONE', '+14155550100'),
      sample('UPI_ID', 'fraud@okaxis'), sample('EMAIL', 'fraud@example.test'),
      sample('PHRASE', 'share your verification code immediately'),
    ]));
    await service.processAnalysis(c._id.toString(), result([sample('PHONE', '+1 (415) 555-0100')]));

    const phone = await ThreatIndicator.findOne({ type: 'PHONE', normalizedValue: '+14155550100' }).lean().exec();
    assert.ok(phone);
    assert.equal(phone.reportIds.length, 3, 'one normalized indicator must link to three reports');
    const storedReports = await Report.find({ _id: { $in: reports.map(({ _id }) => _id) } }).lean().exec();
    assert.ok(storedReports.every(({ campaignIds, relatedReports }) => campaignIds.length === 0 && relatedReports.length === 2));
    const aToB = storedReports.find(({ _id }) => _id.equals(a._id))?.relatedReports.find(({ reportId }) => reportId.equals(b._id));
    assert.ok(aToB);
    assert.equal(aToB.level, 'STRONG_RELATION');
    assert.ok(aToB.reasons.some(({ type }) => type === 'SHARED_DOMAIN'));
    assert.ok(aToB.reasons.every(({ explanation, indicatorType, weight }) => explanation && indicatorType && weight > 0));

    const categoryOnly = await Report.create([
      { referenceId: `TG-P5A-${Date.now()}-D`, inputType: 'text', source: 'web', category: 'bank_impersonation', content: 'synthetic category-only D' },
      { referenceId: `TG-P5A-${Date.now()}-E`, inputType: 'text', source: 'web', category: 'bank_impersonation', content: 'synthetic category-only E' },
    ]);
    for (const item of categoryOnly) await service.processAnalysis(item._id.toString(), result([]));
    const categoryOnlyStored = await Report.find({ _id: { $in: categoryOnly.map(({ _id }) => _id) } }).lean().exec();
    assert.ok(categoryOnlyStored.every(({ relatedReports }) => relatedReports.length === 0), 'category alone must not correlate reports');
  } finally {
    if (connected) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  }
}

await verifyDatabaseIntegration();
console.log(JSON.stringify({
  normalization: 'PASS',
  deterministicMatchingCases: 11,
  databaseLinking: 'PASS',
  duplicateSuppression: 'PASS',
  threeReportIndicatorRelationship: 'PASS',
  explainability: 'PASS',
  temporaryDatabaseCleaned: true,
  status: 'PASS',
}, null, 2));
