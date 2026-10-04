import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AnalysisEngine } from '../src/services/analysis/AnalysisEngine.js';
import { ScreenshotOcrService } from '../src/services/analysis/ScreenshotOcrService.js';
import { RuleAnalysisProvider } from '../src/services/analysis/providers/RuleAnalysisProvider.js';
import { UrlAnalysisProvider } from '../src/services/analysis/providers/UrlAnalysisProvider.js';
import { GeminiAnalysisProvider } from '../src/services/analysis/providers/GeminiAnalysisProvider.js';
import type { AnalysisProvider } from '../src/services/analysis/providers/AnalysisProvider.js';
import type { AnalysisInput, AnalysisProviderResult } from '../src/types/analysis.js';

const rules = new RuleAnalysisProvider();
const urls = new UrlAnalysisProvider();
const engine = new AnalysisEngine([rules, urls]);
const input = (content: string, inputType: AnalysisInput['inputType'] = 'text'): AnalysisInput => ({ inputType, source: 'web', content });

const phishing = await engine.analyze(input('Bank officer: your account is blocked today. Send your OTP immediately.'));
assert.equal(phishing.riskLevel, 'HIGH_CONCERN');
assert.ok(phishing.reasons.length > 0 && phishing.evidence.length > 0);
assert.ok(phishing.providersUsed.includes('deterministic-baseline-rules'));
assert.ok(phishing.uncertainty.length > 0);

const legitimate = await engine.analyze(input('Thanks, I will meet you at the library at 3 pm.'));
assert.equal(legitimate.riskLevel, 'NO_STRONG_WARNING_SIGNS');
assert.ok(/not proof|not guarantee|does not guarantee/i.test(legitimate.uncertainty));

const english = await engine.analyze(input('Your bank account will close today. Verify immediately and send the OTP.'));
const tanglish = await engine.analyze(input('TANGEDCO officer solren, ippove current cut aagum. OTP anuppunga.'));
assert.ok(english.reasons.some(({ category }) => category === 'credential_request'));
assert.ok(tanglish.reasons.some(({ category }) => category === 'credential_request'));

const link = await engine.analyze(input('Check https://bit.ly/demo for details.'));
assert.equal(link.riskLevel, 'NEEDS_VERIFICATION', 'a weak URL signal must not elevate to high concern');
assert.ok(link.urls.length === 1 && link.indicators.some(({ type }) => type === 'URL'));
const multiple = await engine.analyze(input('Visit https://example.com and https://bit.ly/demo'));
assert.equal(multiple.urls.length, 2);
assert.equal(multiple.indicators.filter(({ type }) => type === 'URL').length, 2);

const indicatorMessage = 'Call +1 (415) 555-2671 or 98765 43210. Email Report@Example.com. UPI ID: Akash@OKAXIS. Send your OTP immediately.';
const extracted = await engine.analyze(input(indicatorMessage));
const phones = extracted.indicators.filter(({ type }) => type === 'PHONE');
assert.ok(phones.some(({ normalizedValue }) => normalizedValue === '+14155552671'));
assert.ok(phones.some(({ normalizedValue }) => normalizedValue === '9876543210'));
assert.ok(!phones.some(({ normalizedValue }) => normalizedValue.startsWith('+91')), 'country code must not be invented');
assert.ok(extracted.indicators.some(({ type, normalizedValue }) => type === 'EMAIL' && normalizedValue === 'report@example.com'));
assert.ok(extracted.indicators.some(({ type, normalizedValue }) => type === 'UPI_ID' && normalizedValue === 'akash@okaxis'));
assert.ok(extracted.indicators.some(({ type, normalizedValue }) => type === 'PHRASE' && normalizedValue.includes('otp')));
assert.ok(extracted.indicators.every(({ normalizedValue, confidence, evidence }) => Boolean(normalizedValue) && confidence >= 0 && Boolean(evidence)));

const mixed = await engine.analyze(input('Pay Rs 500 now. Email help@example.com; UPI: user@ybl; open https://example.com/verify'));
for (const type of ['URL', 'DOMAIN', 'EMAIL', 'UPI_ID', 'PHRASE'] as const) {
  assert.ok(mixed.indicators.some((indicator) => indicator.type === type), `mixed input missing ${type}`);
}

const ambiguous = await engine.analyze(input('Please review example.com when convenient.'));
assert.equal(ambiguous.riskLevel, 'NEEDS_VERIFICATION');
assert.ok(ambiguous.uncertainty.length > 0);

const unavailableGemini = new GeminiAnalysisProvider({ apiKey: '' });
const degradedEngine = new AnalysisEngine([rules, urls, unavailableGemini]);
const degraded = await degradedEngine.analyze(input('An ordinary message without warning terms.'));
assert.equal(degraded.riskLevel, 'NEEDS_VERIFICATION');
assert.ok(degraded.warnings.some(({ provider }) => provider === 'gemini'));
const deterministicContinues = await degradedEngine.analyze(input('Bank officer: account blocked, send OTP immediately.'));
assert.equal(deterministicContinues.riskLevel, 'HIGH_CONCERN');

const suggestedOnlyProvider: AnalysisProvider = {
  name: 'mock-model',
  analyze: async (): Promise<AnalysisProviderResult> => ({ signals: [], assessment: {
    provider: 'mock-model', suspectedCategory: 'credential_request', requestedAction: 'share a code',
    uncertainty: 'The model suggestion is uncertain.', suggestedRiskLevel: 'HIGH_CONCERN', confidence: 0.99,
  } }),
};
const modelSuggestion = await new AnalysisEngine([suggestedOnlyProvider]).analyze(input('We are meeting at noon.'));
assert.equal(modelSuggestion.riskLevel, 'NO_STRONG_WARNING_SIGNS', 'model suggestion cannot override the signal-based risk gate');
assert.equal(modelSuggestion.category, 'credential_request');
assert.equal(modelSuggestion.requestedAction, 'share a code');

const fixture = new Uint8Array(await readFile(new URL('./fixtures/mixed-url-payment.png', import.meta.url)));
const ocr = new ScreenshotOcrService();
try {
  const screenshotEngine = new AnalysisEngine([rules, urls], ocr);
  const screenshot = await screenshotEngine.analyzeScreenshot({ source: 'web' }, fixture, 'image/png');
  assert.ok(screenshot.ocr?.extractedText);
  assert.ok(screenshot.urls.some(({ domain }) => domain === 'bit.ly'));
  assert.ok(screenshot.indicators.some(({ type }) => type === 'URL'));
  assert.ok(screenshot.indicators.some(({ type }) => type === 'PHRASE'));
  assert.ok(screenshot.indicators.some(({ source }) => source === 'ocr'));
  const lowQualityImage = new Uint8Array(await readFile(new URL('./fixtures/low-quality.png', import.meta.url)));
  const uncertainScreenshot = await screenshotEngine.analyzeScreenshot({ source: 'web' }, lowQualityImage, 'image/png');
  assert.equal(uncertainScreenshot.ocr?.needsReview, true);
  assert.equal(uncertainScreenshot.riskLevel, 'NEEDS_VERIFICATION');
  assert.ok(uncertainScreenshot.confidence <= 0.25);
  await screenshotEngine.close();
} finally {
  await ocr.close();
}

const failedOcrEngine = new AnalysisEngine([rules, urls], new ScreenshotOcrService(async () => {
  throw new Error('synthetic worker failure');
}));
const failedOcr = await failedOcrEngine.analyzeScreenshot({ source: 'web' }, fixture, 'image/png');
assert.equal(failedOcr.ocr?.status, 'failed');
assert.equal(failedOcr.riskLevel, 'NEEDS_VERIFICATION');
await failedOcrEngine.close();

const failedUrlProvider = new UrlAnalysisProvider({ extract: () => { throw new Error('synthetic URL failure'); } });
const failedUrl = await new AnalysisEngine([rules, failedUrlProvider]).analyze(input('Please send your OTP now.'));
assert.ok(failedUrl.reasons.some(({ category }) => category === 'credential_request'));
assert.ok(failedUrl.warnings.some(({ provider }) => provider === 'url-analysis'));

console.log(JSON.stringify({
  testGroups: ['text labels and languages', 'URLs and multiple URLs', 'URL weak-signal risk gate', 'PHONE/EMAIL/UPI_ID/PHRASE extraction and normalization', 'mixed indicators', 'uncertainty/category/action/provider metadata', 'Gemini unavailable and suggestion-only behavior', 'screenshot OCR unified analysis', 'OCR failure', 'URL provider failure'],
  indicatorCount: extracted.indicators.length,
  screenshotOcrStatus: 'PASS',
  status: 'PASS',
}, null, 2));
