import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../src/config/env.js';
import { AnalysisEngine } from '../src/services/analysis/AnalysisEngine.js';
import { RuleAnalysisProvider } from '../src/services/analysis/providers/RuleAnalysisProvider.js';
import { UrlAnalysisProvider } from '../src/services/analysis/providers/UrlAnalysisProvider.js';
import { GeminiAnalysisProvider } from '../src/services/analysis/providers/GeminiAnalysisProvider.js';
import type { AnalysisInput, AnalysisProvider, AnalysisProviderResult, AnalysisRiskLevel } from '../src/types/analysis.js';

interface DatasetRow {
  text: string;
  label: 'ham' | 'phishing';
  language: 'en' | 'tanglish';
  category: string;
  risk_level: 'low' | 'medium' | 'high';
}

interface EvaluatedRow {
  row: number;
  category: string;
  language: DatasetRow['language'];
  label: DatasetRow['label'];
  datasetRiskLevel: DatasetRow['risk_level'];
  deterministicRiskLevel: AnalysisRiskLevel;
  geminiSuggestedRiskLevel: AnalysisRiskLevel;
  combinedRiskLevel: AnalysisRiskLevel;
  geminiConfidence: number;
  geminiSignalCategories: string[];
}

interface Checkpoint {
  version: string;
  sampleHashes: string[];
  results: Record<string, EvaluatedRow>;
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const REFERENCE_PATH = resolve(ROOT, 'datasets/processed/evaluation_reference.json');
const OUTPUT_DIR = resolve(process.cwd(), 'analysis-artifacts');
const CHECKPOINT_PATH = resolve(OUTPUT_DIR, '.phase4b-gemini-checkpoint.json');
const OUTPUT_PATH = resolve(OUTPUT_DIR, 'phase4b-live-gemini-reference-evaluation.json');
const SEED = 'thoondilguard-phase4b-gemini-reference-v1';
const PER_CATEGORY_LANGUAGE = 5;
const REQUEST_INTERVAL_MS = 4_100;
const MODEL = 'gemini-3.8-flash';

function fingerprint(text: string): string {
  return text.toLowerCase()
    .replace(/(?:https?:\/\/|www\.)[^\s]+/giu, ' <url> ')
    .replace(/\b[a-z0-9._-]+@[a-z][a-z0-9.-]+\b/giu, ' <upi-or-email> ')
    .replace(/(?<!\w)(?:\+?\d[\d\s().-]{7,}\d)(?!\w)/gu, ' <number> ')
    .replace(/\b\d+(?:[,.]\d+)*\b/gu, ' <number> ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function contentHash(row: DatasetRow): string {
  return createHash('sha256').update(`${row.category}\0${row.language}\0${row.text.toLowerCase()}`).digest('hex');
}

function deterministicOrder(row: DatasetRow): string {
  return createHash('sha256').update(`${SEED}\0${row.text.toLowerCase()}`).digest('hex');
}

function selectSample(rows: DatasetRow[]): Array<{ row: DatasetRow; sourceIndex: number }> {
  const strata = new Map<string, Map<string, { row: DatasetRow; sourceIndex: number }>>();
  rows.forEach((row, sourceIndex) => {
    const stratum = `${row.category}\0${row.language}`;
    let templates = strata.get(stratum);
    if (!templates) {
      templates = new Map();
      strata.set(stratum, templates);
    }
    const template = fingerprint(row.text);
    if (!templates.has(template)) templates.set(template, { row, sourceIndex });
  });
  const selected: Array<{ row: DatasetRow; sourceIndex: number }> = [];
  for (const candidates of strata.values()) {
    const ordered = [...candidates.values()].sort((left, right) => deterministicOrder(left.row).localeCompare(deterministicOrder(right.row)));
    selected.push(...ordered.slice(0, PER_CATEGORY_LANGUAGE));
  }
  return selected.sort((left, right) => left.sourceIndex - right.sourceIndex);
}

function positive(risk: AnalysisRiskLevel): boolean {
  return risk !== 'NO_STRONG_WARNING_SIGNS';
}

function datasetRisk(risk: DatasetRow['risk_level']): AnalysisRiskLevel {
  if (risk === 'high') return 'HIGH_CONCERN';
  if (risk === 'medium') return 'NEEDS_VERIFICATION';
  return 'NO_STRONG_WARNING_SIGNS';
}

function metrics(rows: readonly EvaluatedRow[], prediction: (row: EvaluatedRow) => AnalysisRiskLevel): Record<string, unknown> {
  let tp = 0; let fp = 0; let tn = 0; let fn = 0; let riskMatched = 0;
  const riskMatrix: Record<string, Record<string, number>> = {};
  for (const row of rows) {
    const predicted = prediction(row);
    const actualPositive = row.label === 'phishing';
    if (actualPositive && positive(predicted)) tp += 1;
    else if (!actualPositive && positive(predicted)) fp += 1;
    else if (!actualPositive) tn += 1;
    else fn += 1;
    if (predicted === datasetRisk(row.datasetRiskLevel)) riskMatched += 1;
    const expected = datasetRisk(row.datasetRiskLevel);
    riskMatrix[expected] ??= {};
    riskMatrix[expected][predicted] = (riskMatrix[expected][predicted] ?? 0) + 1;
  }
  const count = rows.length;
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  return {
    count, tp, fp, tn, fn,
    accuracy: Number(((tp + tn) / count).toFixed(4)),
    precision: Number(precision.toFixed(4)),
    recall: Number(recall.toFixed(4)),
    f1: Number((precision + recall ? (2 * precision * recall) / (precision + recall) : 0).toFixed(4)),
    datasetRiskLevelAgreement: Number((riskMatched / count).toFixed(4)),
    datasetRiskConfusion: riskMatrix,
  };
}

function groupMetrics(rows: readonly EvaluatedRow[], key: 'language' | 'category' | 'datasetRiskLevel') {
  const groups = new Map<string, EvaluatedRow[]>();
  for (const row of rows) {
    const value = row[key];
    const list = groups.get(value) ?? [];
    list.push(row);
    groups.set(value, list);
  }
  return Object.fromEntries([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([value, list]) => [
    value,
    {
      count: list.length,
      baseline: metrics(list, (row) => row.deterministicRiskLevel),
      gemini: metrics(list, (row) => row.geminiSuggestedRiskLevel),
      combined: metrics(list, (row) => row.combinedRiskLevel),
    },
  ]));
}

function errorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') return error.code;
  return 'unknown_error';
}

async function atomicWrite(path: string, value: unknown): Promise<void> {
  const tempPath = `${path}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(tempPath, path);
}

class ReplayGeminiProvider implements AnalysisProvider {
  readonly name = 'gemini';
  result: AnalysisProviderResult = { signals: [] };
  analyze(): AnalysisProviderResult { return this.result; }
}

const rows = JSON.parse(await readFile(REFERENCE_PATH, 'utf8')) as DatasetRow[];
assert.equal(rows.length, 885, 'prepared evaluation reference should remain unchanged and complete');
const sample = selectSample(rows);
const sampleHashes = sample.map(({ row }) => contentHash(row));
const args = process.argv.slice(2);
const limitArg = args.find((argument) => argument.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.slice('--limit='.length)) : sample.length;
assert.ok(Number.isInteger(limit) && limit >= 1 && limit <= sample.length, 'invalid evaluation limit');
const selected = sample.slice(0, limit);

const strataCounts = Object.fromEntries([...selected.reduce((counts, { row }) => {
  const key = `${row.category}/${row.language}`;
  counts.set(key, (counts.get(key) ?? 0) + 1);
  return counts;
}, new Map<string, number>()).entries()].sort(([left], [right]) => left.localeCompare(right)));
if (args.includes('--plan')) {
  console.log(JSON.stringify({ mode: 'plan_only', referenceRecords: rows.length, sampleSize: sample.length, selectedRecords: selected.length, distinctTemplateStrata: Object.keys(strataCounts).length, strataCounts }));
} else if (!env.geminiApiKey) {
  console.log(JSON.stringify({ apiKeyConfigured: false, model: MODEL, sampleSize: sample.length, status: 'FAIL', cause: 'not_configured' }));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ apiKeyConfigured: true, model: MODEL, sampleSize: sample.length, requestLimit: limit }));
  await mkdir(OUTPUT_DIR, { recursive: true });
  let checkpoint: Checkpoint = { version: SEED, sampleHashes, results: {} };
  try {
    checkpoint = JSON.parse(await readFile(CHECKPOINT_PATH, 'utf8')) as Checkpoint;
    assert.equal(checkpoint.version, SEED);
    assert.deepEqual(checkpoint.sampleHashes, sampleHashes, 'checkpoint sample does not match current deterministic selection');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      checkpoint = { version: SEED, sampleHashes, results: {} };
    } else {
      throw error;
    }
  }

  const provider = new GeminiAnalysisProvider({ apiKey: env.geminiApiKey, model: MODEL });
  const baselineEngine = new AnalysisEngine([new RuleAnalysisProvider()]);
  const replay = new ReplayGeminiProvider();
  const combinedEngine = new AnalysisEngine([new RuleAnalysisProvider(), replay, new UrlAnalysisProvider()]);
  let requestCount = 0;
  let attemptedCount = 0;
  let lastRequestAt = 0;
  let failed: { row: number; cause: string } | undefined;

  for (const { row, sourceIndex } of selected) {
    const key = contentHash(row);
    if (checkpoint.results[key]) continue;
    const input: AnalysisInput = { inputType: 'text', source: 'web', content: row.text, metadata: { locale: row.language } };
    try {
      const waitMs = Math.max(0, REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt));
      if (requestCount > 0 && waitMs > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, waitMs));
      attemptedCount += 1;
      const modelResult = await provider.analyze(input);
      lastRequestAt = Date.now();
      requestCount += 1;
      assert.ok(modelResult.assessment, 'Gemini response did not include a structured assessment');
      const baseline = await baselineEngine.analyze(input);
      replay.result = modelResult;
      const combined = await combinedEngine.analyze(input);
      checkpoint.results[key] = {
        row: sourceIndex + 1,
        category: row.category,
        language: row.language,
        label: row.label,
        datasetRiskLevel: row.risk_level,
        deterministicRiskLevel: baseline.riskLevel,
        geminiSuggestedRiskLevel: modelResult.assessment.suggestedRiskLevel,
        combinedRiskLevel: combined.riskLevel,
        geminiConfidence: modelResult.assessment.confidence,
        geminiSignalCategories: [...new Set(modelResult.signals.map(({ reason }) => reason.category))].sort(),
      };
      await atomicWrite(CHECKPOINT_PATH, checkpoint);
      const completed = Object.keys(checkpoint.results).length;
      if (completed === 1 || completed % 10 === 0 || completed === selected.length) {
        console.log(JSON.stringify({ completed, selected: selected.length, newRequests: requestCount }));
      }
    } catch (error) {
      failed = { row: sourceIndex + 1, cause: errorCode(error) };
      break;
    }
  }

  const completedResults = Object.values(checkpoint.results);
  if (failed) {
    console.log(JSON.stringify({ status: 'FAIL', completed: completedResults.length, attemptedThisRun: attemptedCount, row: failed.row, cause: failed.cause }));
    process.exitCode = 1;
  } else if (completedResults.length < sample.length) {
    console.log(JSON.stringify({ status: 'INCOMPLETE', completed: completedResults.length, selected: sample.length, attemptedThisRun: attemptedCount }));
    process.exitCode = 1;
  } else {
    const bySystem = {
      deterministicBaseline: metrics(completedResults, (row) => row.deterministicRiskLevel),
      geminiSuggestion: metrics(completedResults, (row) => row.geminiSuggestedRiskLevel),
      combinedEngine: metrics(completedResults, (row) => row.combinedRiskLevel),
    };
    const disagreements = completedResults.filter((row) => row.deterministicRiskLevel !== row.geminiSuggestedRiskLevel);
    const falseCases = (system: 'deterministicRiskLevel' | 'geminiSuggestedRiskLevel') => completedResults
      .filter((row) => (row.label === 'phishing') !== positive(row[system]))
      .map(({ row, category, language, label, datasetRiskLevel, ...rest }) => ({
        row, category, language, label, datasetRiskLevel, predictedRiskLevel: rest[system],
      }));
    const report = {
      createdAt: new Date().toISOString(),
      dataset: 'synthetic reference/evaluation set; not training data',
      referenceRecords: rows.length,
      evaluatedRecords: completedResults.length,
      model: MODEL,
      sampleMethod: `Deterministic fixed-seed selection of up to ${PER_CATEGORY_LANGUAGE} distinct normalized templates per category × language stratum; one sample across all ${new Set(rows.map(({ category }) => category)).size} categories and both languages.`,
      sampleSeed: SEED,
      labelMapping: { phishing: 'HIGH_CONCERN or NEEDS_VERIFICATION', ham: 'NO_STRONG_WARNING_SIGNS' },
      riskLevelMapping: { high: 'HIGH_CONCERN', medium: 'NEEDS_VERIFICATION', low: 'NO_STRONG_WARNING_SIGNS' },
      metrics: bySystem,
      subgroupMetrics: {
        language: groupMetrics(completedResults, 'language'),
        category: groupMetrics(completedResults, 'category'),
        datasetRiskLevel: groupMetrics(completedResults, 'datasetRiskLevel'),
      },
      agreement: {
        deterministicVsGeminiRiskAgreement: Number((completedResults.filter(({ deterministicRiskLevel, geminiSuggestedRiskLevel }) => deterministicRiskLevel === geminiSuggestedRiskLevel).length / completedResults.length).toFixed(4)),
        deterministicVsGeminiBinaryAgreement: Number((completedResults.filter(({ deterministicRiskLevel, geminiSuggestedRiskLevel }) => positive(deterministicRiskLevel) === positive(geminiSuggestedRiskLevel)).length / completedResults.length).toFixed(4)),
        disagreementRows: disagreements.map(({ row, category, language, deterministicRiskLevel, geminiSuggestedRiskLevel }) => ({ row, category, language, deterministicRiskLevel, geminiSuggestedRiskLevel })),
      },
      falsePositivesAndNegatives: {
        deterministicBaseline: falseCases('deterministicRiskLevel'),
        geminiSuggestion: falseCases('geminiSuggestedRiskLevel'),
        combinedEngine: completedResults.filter((row) => (row.label === 'phishing') !== positive(row.combinedRiskLevel))
          .map(({ row, category, language, label, combinedRiskLevel }) => ({ row, category, language, label, predictedRiskLevel: combinedRiskLevel })),
      },
      calibrationDecision: 'No thresholds were tuned to this synthetic sample. Calibration retains the conservative existing signal conjunction; Gemini risk suggestions remain advisory. Category purity and risk-label leakage prevent treating these labels as independent calibration ground truth.',
      rows: completedResults.sort((a, b) => a.row - b.row),
    };
    await atomicWrite(OUTPUT_PATH, report);
    console.log(JSON.stringify({ status: 'PASS', evaluatedRecords: completedResults.length, output: OUTPUT_PATH, metrics: bySystem }));
  }
}
