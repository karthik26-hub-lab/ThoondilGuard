import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AnalysisEngine } from '../src/services/analysis/AnalysisEngine.js';
import { ScreenshotInputError, ScreenshotOcrService } from '../src/services/analysis/ScreenshotOcrService.js';
import { UrlAnalysisService } from '../src/services/analysis/UrlAnalysisService.js';
import { RuleAnalysisProvider } from '../src/services/analysis/providers/RuleAnalysisProvider.js';
import { UrlAnalysisProvider } from '../src/services/analysis/providers/UrlAnalysisProvider.js';

const urls = new UrlAnalysisService();
const get = (text: string) => urls.extract(text);
const normal = get('Please visit https://www.example.com/help.');
assert.equal(normal.length, 1);
assert.equal(normal[0]?.scheme, 'https');
assert.equal(normal[0]?.domain, 'example.com');
assert.equal(normal[0]?.signals.length, 0, 'ordinary HTTPS URL has no heuristic warnings');

assert.ok(get('http://example.com')[0]?.signals.some(({ type }) => type === 'http_scheme'));
assert.ok(get('https://192.0.2.12/account')[0]?.signals.some(({ type }) => type === 'ip_address_host'));
assert.ok(get('https://bit.ly/abc')[0]?.signals.some(({ type }) => type === 'known_shortener'));
assert.ok(get('https://a.b.c.d.example.com/path')[0]?.signals.some(({ type }) => type === 'excessive_subdomains'));
assert.ok(get('https://paypal-support-login.xyz/verify')[0]?.signals.some(({ type }) => type === 'brand_like_domain'));
assert.ok(get('https://example.com/%2Flogin')[0]?.signals.some(({ type }) => type === 'percent_encoding'));
assert.ok(get('https://example.com/login/verify')[0]?.signals.some(({ type }) => type === 'suspicious_path'));
assert.equal(get('https://www.gov.uk/services')[0]?.signals.length, 0);
assert.equal(get('Two URLs: https://example.com and http://example.net').length, 2);
assert.equal(get('Malformed hxxp://[broken').length, 0);
const queryUrl = get('https://example.com/?token=do-not-return&next=https%3A%2F%2Fevil.test')[0];
assert.ok(queryUrl?.signals.some(({ type }) => type === 'redirect_parameter'));
assert.ok(queryUrl?.queryParameters.some(({ name, value }) => name === 'next' && value?.includes('https://')));
assert.ok(!queryUrl?.normalizedUrl.includes('do-not-return'), 'sensitive URL query values must be redacted');
assert.ok(get('https://аррӏе.com')[0]?.signals.some(({ type }) => type === 'punycode_hostname'));

const rule = new RuleAnalysisProvider();
const urlProvider = new UrlAnalysisProvider();
const engine = new AnalysisEngine([rule, urlProvider]);
const plainText = await engine.analyze({ inputType: 'text', source: 'web', content: 'Are we meeting at noon?' });
assert.ok(Array.isArray(plainText.urls));
const urlText = await engine.analyze({ inputType: 'text', source: 'web', content: 'Verify your account at http://bit.ly/demo' });
assert.ok(urlText.urls.some(({ domain }) => domain === 'bit.ly'));
assert.ok(urlText.indicators.some(({ type }) => type === 'URL'));
assert.ok(urlText.evidence.some(({ source }) => source === 'url'));

const fixture = async (name: string) => new Uint8Array(await readFile(new URL(`./fixtures/${name}`, import.meta.url)));
const ocr = new ScreenshotOcrService();
try {
  const english = await ocr.extract(await fixture('english.png'), 'image/png');
  assert.equal(english.status, 'complete');
  assert.ok(english.extractedText.toLowerCase().includes('closed'));
  assert.equal(english.script, 'Latin');

  const tanglish = await ocr.extract(await fixture('tanglish.png'), 'image/png');
  assert.ok(tanglish.extractedText.toLowerCase().includes('anuppunga'));
  assert.equal(tanglish.language, 'ta-Latn');

  const mixedImage = await fixture('mixed-url-payment.png');
  const mixed = await ocr.extract(mixedImage, 'image/png');
  assert.ok(mixed.extractedText.toLowerCase().includes('500'));
  assert.ok(mixed.extractedText.toLowerCase().includes('bit.ly'));

  const lowQuality = await ocr.extract(await fixture('low-quality.png'), 'image/png');
  assert.equal(lowQuality.needsReview, true);
  assert.notEqual(lowQuality.status, 'complete');

  const screenshotEngine = new AnalysisEngine([rule, urlProvider], ocr);
  const screenshotResult = await screenshotEngine.analyzeScreenshot({ source: 'web' }, mixedImage, 'image/png');
  assert.ok(screenshotResult.ocr?.extractedText.includes('bit.ly'));
  assert.ok(screenshotResult.urls.some(({ domain }) => domain === 'bit.ly'));
  assert.ok(screenshotResult.reasons.some(({ category }) => category === 'payment_request'));
  assert.equal(screenshotResult.riskLevel, 'NEEDS_VERIFICATION', 'OCR uncertainty must not be treated as ground truth');
  const correctedResult = await screenshotEngine.analyzeScreenshot(
    { source: 'web', extractedText: 'Please send your OTP now.' },
    await fixture('low-quality.png'),
    'image/png',
  );
  assert.equal(correctedResult.ocr?.needsReview, true);
  assert.ok(correctedResult.confidence > 0.25, 'caller-corrected text should be analyzed without an OCR confidence cap');
  await screenshotEngine.close();

  await assert.rejects(() => ocr.extract(mixedImage, 'image/jpeg'), (error: unknown) => error instanceof ScreenshotInputError);
  await assert.rejects(() => ocr.extract(Buffer.from('<svg></svg>'), 'image/svg+xml'), ScreenshotInputError);
  await assert.rejects(() => ocr.extract(new Uint8Array(5 * 1024 * 1024 + 1)), (error: unknown) =>
    error instanceof ScreenshotInputError && error.code === 'image_too_large');
} finally {
  await ocr.close();
}

const failingOcrEngine = new AnalysisEngine([rule, urlProvider], new ScreenshotOcrService(async () => {
  throw new Error('test failure');
}));
const failureImage = await fixture('english.png');
const failedOcrResult = await failingOcrEngine.analyzeScreenshot({ source: 'web' }, failureImage, 'image/png');
assert.equal(failedOcrResult.ocr?.status, 'failed');
assert.equal(failedOcrResult.riskLevel, 'NEEDS_VERIFICATION');
await failingOcrEngine.close();

const brokenUrlProvider = new UrlAnalysisProvider({ extract: () => { throw new Error('test failure'); } });
const resilientEngine = new AnalysisEngine([rule, brokenUrlProvider]);
const resilient = await resilientEngine.analyze({ inputType: 'text', source: 'web', content: 'Please send your OTP now.' });
assert.ok(resilient.reasons.some(({ category }) => category === 'credential_request'));
assert.ok(resilient.warnings.some(({ provider }) => provider === 'url-analysis'));

console.log(JSON.stringify({
  urlCases: 13,
  ocrCases: ['clear English', 'Tanglish', 'URL/payment', 'low quality', 'invalid type', 'oversized image', 'worker failure'],
  integrationCases: ['plain text', 'text plus URL', 'screenshot OCR plus URL/rule analysis', 'URL provider failure'],
  status: 'PASS',
}, null, 2));
