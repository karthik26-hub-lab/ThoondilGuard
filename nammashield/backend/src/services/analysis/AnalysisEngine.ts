import { z } from 'zod';
import { env } from '../../config/env.js';
import {
  ANALYSIS_ENGINE_VERSION,
  ANALYSIS_INPUT_TYPES,
  ANALYSIS_RISK_LEVELS,
  ANALYSIS_SOURCES,
} from '../../types/analysis.js';
import type {
  AnalysisInput,
  AnalysisProviderAssessment,
  AnalysisProviderWarning,
  AnalysisReason,
  AnalysisResult,
  AnalysisRiskLevel,
  AnalysisSignal,
} from '../../types/analysis.js';
import type { AnalysisInput as ParsedAnalysisInput } from '../../types/analysis.js';
import type { AnalysisProvider } from './providers/AnalysisProvider.js';
import { RuleAnalysisProvider } from './providers/RuleAnalysisProvider.js';
import { GeminiAnalysisProvider } from './providers/GeminiAnalysisProvider.js';
import { UrlAnalysisProvider } from './providers/UrlAnalysisProvider.js';
import { ScreenshotOcrService } from './ScreenshotOcrService.js';
import { IndicatorExtractionService } from './IndicatorExtractionService.js';

const locationSchema = z.object({
  city: z.string().trim().max(120).optional(),
  district: z.string().trim().max(120).optional(),
  region: z.string().trim().max(120).optional(),
}).strict();

const analysisInputSchema = z.object({
  inputType: z.enum(ANALYSIS_INPUT_TYPES),
  source: z.enum(ANALYSIS_SOURCES),
  content: z.string().max(20_000).optional(),
  extractedText: z.string().max(50_000).optional(),
  url: z.string().trim().max(2_048).optional(),
  metadata: z.object({ locale: z.string().trim().max(20).optional() }).strict().optional(),
  category: z.string().trim().max(80).optional(),
  location: locationSchema.optional(),
}).strict();

export class AnalysisInputError extends Error {
  constructor() {
    super('Analysis input is invalid.');
    this.name = 'AnalysisInputError';
  }
}

export function parseAnalysisInput(input: unknown): AnalysisInput {
  const parsed = analysisInputSchema.safeParse(input);
  if (!parsed.success) throw new AnalysisInputError();
  return parsed.data;
}

function hasAnalyzableContent(input: AnalysisInput): boolean {
  return [input.content, input.extractedText, input.url].some((value) => Boolean(value?.trim()));
}

function determineRisk(signals: readonly AnalysisSignal[], hasContent: boolean, hasProviderFailure: boolean): AnalysisRiskLevel {
  if (!hasContent || hasProviderFailure && !signals.some(({ reason }) => reason.severity === 'high')) {
    return 'NEEDS_VERIFICATION';
  }

  const meaningfulSignals = signals.filter(({ reason }) => reason.severity !== 'low');
  const distinctCategories = new Set(meaningfulSignals.map(({ reason }) => reason.category));
  const hasHighSeveritySignal = signals.some(({ reason }) => reason.severity === 'high');
  const hasActionSignal = meaningfulSignals.some(({ reason }) => [
    'payment_request', 'request_for_sensitive_information', 'apk_installation', 'fake_reward_or_refund', 'impersonation',
  ].includes(reason.category));
  const hasPressureSignal = meaningfulSignals.some(({ reason }) => ['urgency', 'threat_or_pressure'].includes(reason.category));

  if (hasHighSeveritySignal && hasActionSignal && hasPressureSignal && distinctCategories.size >= 3) return 'HIGH_CONCERN';
  if (signals.length > 0) return 'NEEDS_VERIFICATION';
  return 'NO_STRONG_WARNING_SIGNS';
}

function confidenceFor(riskLevel: AnalysisRiskLevel, hasContent: boolean, hasProviderFailure: boolean): number {
  if (!hasContent) return 0.15;
  if (hasProviderFailure && riskLevel !== 'HIGH_CONCERN') return 0.25;
  if (riskLevel === 'HIGH_CONCERN') return 0.72;
  if (riskLevel === 'NEEDS_VERIFICATION') return 0.48;
  return 0.35;
}

function summaryFor(riskLevel: AnalysisRiskLevel, hasContent: boolean, hasProviderFailure: boolean): string {
  if (!hasContent) return 'There is not enough message content for a meaningful assessment; more information is needed.';
  if (riskLevel === 'HIGH_CONCERN') {
    return `Multiple independent warning signals were identified by available checks. Verify the message independently before acting.${hasProviderFailure ? ' Some analysis providers were unavailable.' : ''}`;
  }
  if (hasProviderFailure) return 'Some analysis providers were unavailable; only completed checks are reflected here. Verify the message independently.';
  if (riskLevel === 'NEEDS_VERIFICATION') {
    return 'One or more warning signals were identified, but this baseline cannot determine whether the message is fraudulent. Verify it independently.';
  }
  return 'No strong warning signs were identified by the current checks. This does not guarantee that the message is safe.';
}

export class AnalysisEngine {
  private readonly screenshotOcr: ScreenshotOcrService;
  private readonly indicatorExtraction: IndicatorExtractionService;

  constructor(
    private readonly providers: readonly AnalysisProvider[] = [
      new RuleAnalysisProvider(),
      ...(env.geminiApiKey && env.geminiModel ? [new GeminiAnalysisProvider({ apiKey: env.geminiApiKey })] : []),
      new UrlAnalysisProvider(),
    ],
    screenshotOcr = new ScreenshotOcrService(),
    indicatorExtraction = new IndicatorExtractionService(),
  ) {
    this.screenshotOcr = screenshotOcr;
    this.indicatorExtraction = indicatorExtraction;
  }

  async analyze(input: unknown): Promise<AnalysisResult> {
    const validatedInput = parseAnalysisInput(input);
    const providerExecutions = await Promise.all(this.providers.map(async (provider) => {
      try {
        return { provider: provider.name, result: await provider.analyze(validatedInput) };
      } catch {
        return { provider: provider.name, result: null };
      }
    }));
    const providerFailures = providerExecutions.filter(({ result }) => result === null);
    const providerResults = providerExecutions.flatMap(({ result }) => result ? [result] : []);
    const signals = providerResults.flatMap(({ signals: providerSignals }) => providerSignals);
    const hasContent = hasAnalyzableContent(validatedInput);
    const hasProviderFailure = providerFailures.length > 0;
    const riskLevel = determineRisk(signals, hasContent, hasProviderFailure);

    const reasons: AnalysisReason[] = signals.map(({ reason }) => ({ ...reason }));
    const evidence = signals.flatMap(({ evidence: signalEvidence }) => signalEvidence.map((item) => ({ ...item })));
    const providerIndicators = [
      ...providerResults.flatMap(({ indicators: providerIndicators = [] }) =>
        providerIndicators.map((item) => ({ ...item })),
      ),
      ...signals.flatMap(({ indicators: signalIndicators = [] }) =>
        signalIndicators.map((item) => ({ ...item })),
      ),
    ];
    const providerAssessments: AnalysisProviderAssessment[] = providerResults.flatMap(({ assessment }) =>
      assessment ? [{ ...assessment }] : [],
    );
    const urls = providerResults.flatMap(({ urls: providerUrls = [] }) => providerUrls);
    const analysisText = [validatedInput.content, validatedInput.extractedText, validatedInput.url]
      .filter((value): value is string => Boolean(value?.trim()))
      .join('\n');
    const indicators = this.indicatorExtraction.extract({ text: analysisText, urls, signals, providerIndicators });
    const bestAssessment = [...providerAssessments]
      .filter(({ suspectedCategory }) => suspectedCategory !== null)
      .sort((left, right) => right.confidence - left.confidence)[0];
    const strongestSignal = [...signals].sort((left, right) => {
      const severity = { high: 3, medium: 2, low: 1 } as const;
      return severity[right.reason.severity] - severity[left.reason.severity];
    })[0];
    const uncertainty = providerAssessments.map(({ uncertainty: item }) => item.trim()).filter(Boolean).slice(0, 3).join(' ')
      || (hasProviderFailure
        ? 'One or more analysis providers were unavailable; this result may be incomplete.'
        : riskLevel === 'NO_STRONG_WARNING_SIGNS'
          ? 'No strong signals were found by the available checks; this is not proof that the content is safe.'
          : 'The available signals are heuristic and cannot establish whether the content is fraudulent.');
    const warnings: AnalysisProviderWarning[] = providerFailures.map(({ provider }) => ({
      provider,
      message: 'This provider did not return a result. The assessment uses only completed checks.',
    }));

    return {
      riskLevel,
      category: bestAssessment?.suspectedCategory ?? strongestSignal?.reason.category ?? null,
      summary: summaryFor(riskLevel, hasContent, hasProviderFailure),
      uncertainty,
      requestedAction: bestAssessment?.requestedAction ?? null,
      reasons,
      evidence,
      confidence: confidenceFor(riskLevel, hasContent, hasProviderFailure),
      indicators,
      urls,
      providersUsed: [...new Set(providerExecutions.flatMap(({ provider, result }) => result ? [provider] : []))],
      providerAssessments,
      warnings,
      analyzerVersion: ANALYSIS_ENGINE_VERSION,
      analyzedAt: new Date(),
    };
  }

  async analyzeScreenshot(
    input: Omit<ParsedAnalysisInput, 'inputType'> & { inputType?: 'screenshot' },
    image: Uint8Array,
    mimeType?: string,
  ): Promise<AnalysisResult> {
    const validatedInput = parseAnalysisInput({ ...input, inputType: 'screenshot' });
    const ocr = await this.screenshotOcr.extract(image, mimeType);
    const hasCorrectedText = Boolean(validatedInput.extractedText?.trim());
    const analysisText = hasCorrectedText
      ? validatedInput.extractedText
      : ocr.extractedText;
    const result = await this.analyze({ ...validatedInput, extractedText: analysisText });

    if (ocr.needsReview && !hasCorrectedText) {
      result.riskLevel = 'NEEDS_VERIFICATION';
      result.confidence = Math.min(result.confidence, 0.25);
      result.summary = `${ocr.warning ?? 'Screenshot text extraction is uncertain.'} Verify the message independently.`;
      result.uncertainty = ocr.warning ?? result.uncertainty;
    } else if (ocr.needsReview && hasCorrectedText) {
      result.uncertainty = `${result.uncertainty} Caller-corrected text was used; original OCR output remains uncertain.`;
    }
    if (!hasCorrectedText) {
      const ocrConfidenceFactor = ocr.meanConfidence === null ? 0.5 : ocr.meanConfidence / 100;
      result.indicators = result.indicators.map((indicator) => indicator.source === 'rule'
        ? { ...indicator, source: 'ocr', confidence: Number((indicator.confidence * ocrConfidenceFactor).toFixed(3)) }
        : indicator);
    }
    result.ocr = ocr;
    return result;
  }

  async close(): Promise<void> {
    await this.screenshotOcr.close();
  }
}

export { ANALYSIS_RISK_LEVELS };
