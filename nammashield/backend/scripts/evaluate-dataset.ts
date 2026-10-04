import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AnalysisEngine } from '../src/services/analysis/AnalysisEngine.js';
import { RuleAnalysisProvider } from '../src/services/analysis/providers/RuleAnalysisProvider.js';
import type { AnalysisInput, AnalysisRiskLevel } from '../src/types/analysis.js';

interface EvaluationRow {
  text: string;
  label: 'ham' | 'phishing';
  language: 'en' | 'tanglish';
  category: string;
  risk_level: 'low' | 'medium' | 'high';
}

interface RowOutcome extends EvaluationRow {
  predictedLabel: 'ham' | 'phishing';
  predictedRiskLevel: AnalysisRiskLevel;
  reasons: string[];
}

interface MetricCounts {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
}

function metricSummary(rows: readonly RowOutcome[]): MetricCounts & {
  count: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
} {
  const counts: MetricCounts = { tp: 0, fp: 0, tn: 0, fn: 0 };
  for (const row of rows) {
    const actual = row.label === 'phishing';
    const predicted = row.predictedLabel === 'phishing';
    if (actual && predicted) counts.tp += 1;
    else if (!actual && predicted) counts.fp += 1;
    else if (!actual && !predicted) counts.tn += 1;
    else counts.fn += 1;
  }

  const total = rows.length;
  const accuracy = total ? (counts.tp + counts.tn) / total : 0;
  const precision = counts.tp + counts.fp ? counts.tp / (counts.tp + counts.fp) : 0;
  const recall = counts.tp + counts.fn ? counts.tp / (counts.tp + counts.fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return {
    ...counts,
    count: total,
    accuracy: Number(accuracy.toFixed(4)),
    precision: Number(precision.toFixed(4)),
    recall: Number(recall.toFixed(4)),
    f1: Number(f1.toFixed(4)),
  };
}

function groupMetrics(rows: readonly RowOutcome[], field: 'language' | 'category' | 'risk_level') {
  const groups = new Map<string, RowOutcome[]>();
  for (const row of rows) groups.set(row[field], [...(groups.get(row[field]) ?? []), row]);
  return Object.fromEntries([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, values]) => [key, metricSummary(values)]));
}

function riskLevelTarget(level: EvaluationRow['risk_level']): AnalysisRiskLevel {
  if (level === 'high') return 'HIGH_CONCERN';
  if (level === 'medium') return 'NEEDS_VERIFICATION';
  return 'NO_STRONG_WARNING_SIGNS';
}

async function main(): Promise<void> {
  const root = resolve(process.cwd(), '..', 'datasets', 'processed');
  const referencePath = resolve(root, 'evaluation_reference.json');
  const rows = JSON.parse(readFileSync(referencePath, 'utf8')) as EvaluationRow[];
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Evaluation reference dataset is empty or invalid.');

  // Explicitly use rules only; this script never makes paid Gemini calls.
  const engine = new AnalysisEngine([new RuleAnalysisProvider()]);
  const outcomes: RowOutcome[] = [];
  const riskConfusion: Record<string, Record<string, number>> = {};
  let riskMatches = 0;

  for (const row of rows) {
    const input: AnalysisInput = { inputType: 'text', source: 'web', content: row.text, metadata: { locale: row.language } };
    const result = await engine.analyze(input);
    const predictedLabel = result.riskLevel === 'NO_STRONG_WARNING_SIGNS' ? 'ham' : 'phishing';
    outcomes.push({
      ...row,
      predictedLabel,
      predictedRiskLevel: result.riskLevel,
      reasons: [...new Set(result.reasons.map(({ category }) => category))],
    });

    const target = riskLevelTarget(row.risk_level);
    if (target === result.riskLevel) riskMatches += 1;
    riskConfusion[row.risk_level] ??= {};
    riskConfusion[row.risk_level]![result.riskLevel] = (riskConfusion[row.risk_level]![result.riskLevel] ?? 0) + 1;
  }

  const metrics = metricSummary(outcomes);
  const summary = {
    dataset: 'synthetic reference/evaluation set; not training data',
    datasetFile: 'datasets/processed/evaluation_reference.json',
    rowsEvaluated: outcomes.length,
    evaluationMethod: 'Full cleaned unique reference set; deterministic rules only; no random split due synthetic templates, category-label purity, and risk-label leakage.',
    labelMapping: { phishing: 'predicted phishing when risk is HIGH_CONCERN or NEEDS_VERIFICATION', ham: 'predicted ham only when risk is NO_STRONG_WARNING_SIGNS' },
    binaryMetrics: metrics,
    confusionMatrix: { actualPositive: 'phishing', actualNegative: 'ham', tp: metrics.tp, fp: metrics.fp, tn: metrics.tn, fn: metrics.fn },
    byLanguage: groupMetrics(outcomes, 'language'),
    byCategory: groupMetrics(outcomes, 'category'),
    byDatasetRiskLevel: groupMetrics(outcomes, 'risk_level'),
    datasetRiskAgreement: {
      accuracy: Number((riskMatches / outcomes.length).toFixed(4)),
      matched: riskMatches,
      total: outcomes.length,
      mapping: { high: 'HIGH_CONCERN', medium: 'NEEDS_VERIFICATION', low: 'NO_STRONG_WARNING_SIGNS' },
      confusionMatrix: riskConfusion,
    },
    falsePositives: outcomes.map((row, index) => ({ row: index, category: row.category, language: row.language, actualRisk: row.risk_level, predictedRisk: row.predictedRiskLevel, reasons: row.reasons })).filter((row) => row.predictedRisk !== 'NO_STRONG_WARNING_SIGNS' && outcomes[row.row]?.label === 'ham'),
    falseNegatives: outcomes.map((row, index) => ({ row: index, category: row.category, language: row.language, actualRisk: row.risk_level, predictedRisk: row.predictedRiskLevel, reasons: row.reasons })).filter((row) => row.predictedRisk === 'NO_STRONG_WARNING_SIGNS' && outcomes[row.row]?.label === 'phishing'),
    limitations: [
      'Synthetic records were generated from a fixed template bank, so these descriptive metrics are not estimates of field performance.',
      'Category identifies the label in this data; high and low risk levels also map to a single label. Do not use these fields as model inputs or as independent evaluation evidence.',
      'The dataset is English/Tanglish, but all text is ASCII transliteration; it does not measure Tamil-script performance.',
      'Gemini was intentionally not called by this full-dataset baseline evaluator.',
    ],
  };

  writeFileSync(resolve(root, 'baseline_evaluation.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ rows: outcomes.length, binaryMetrics: metrics, riskAgreement: summary.datasetRiskAgreement.accuracy, falsePositiveCount: summary.falsePositives.length, falseNegativeCount: summary.falseNegatives.length, output: 'datasets/processed/baseline_evaluation.json' }, null, 2));
}

await main();
