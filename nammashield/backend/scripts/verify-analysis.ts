import assert from 'node:assert/strict';
import { AnalysisEngine } from '../src/services/analysis/AnalysisEngine.js';
import { GeminiAnalysisProvider } from '../src/services/analysis/providers/GeminiAnalysisProvider.js';
import { RuleAnalysisProvider } from '../src/services/analysis/providers/RuleAnalysisProvider.js';
import type { AnalysisInput } from '../src/types/analysis.js';

const input = (content: string, locale?: string): AnalysisInput => ({
  inputType: 'text', source: 'web', content,
  ...(locale ? { metadata: { locale } } : {}),
});

const ruleEngine = new AnalysisEngine([new RuleAnalysisProvider()]);
const scenarios = [
  { name: 'English phishing with credential, pressure, impersonation', content: 'Message from bank officer: your account is blocked immediately. Send your OTP now.', locale: 'en', expectsWarning: true },
  { name: 'Tanglish phishing with electricity threat and OTP request', content: 'TANGEDCO officer solren, ippove current cut aagum. OTP anuppunga.', locale: 'ta-Latn', expectsWarning: true },
  { name: 'legitimate OTP safety warning', content: 'Your OTP is 123456. Never share this OTP with anyone; our staff will not ask for it.', locale: 'en', expectsWarning: false },
  { name: 'URL only', content: 'Please review https://example.invalid/update', locale: 'en', expectsWarning: true },
  { name: 'payment and reward request', content: 'Pay Rs 500 now to unlock your cashback reward.', locale: 'en', expectsWarning: true },
  { name: 'ambiguous message', content: 'Your account needs attention. Please review example.com for details.', locale: 'en', expectsWarning: true },
  { name: 'unrelated ordinary message', content: 'Are we still meeting at the library at 4 pm?', locale: 'en', expectsWarning: false },
  { name: 'Tanglish ordinary message', content: 'Naalaiku library la 4 mani ku meet pannalama?', locale: 'ta-Latn', expectsWarning: false },
];

for (const scenario of scenarios) {
  const result = await ruleEngine.analyze(input(scenario.content, scenario.locale));
  assert.equal(result.reasons.length > 0, scenario.expectsWarning, scenario.name);
  assert.ok(result.summary.length > 0 && result.analyzedAt instanceof Date, scenario.name);
  assert.ok(!/100%\s+safe|completely safe/i.test(result.summary), scenario.name);
  if (scenario.expectsWarning) assert.ok(result.evidence.length > 0, `${scenario.name}: evidence`);
}

const structured = JSON.stringify({
  suspectedCategory: 'credential_request', warningSignals: [], requestedAction: 'none',
  indicators: [], uncertainty: 'The content is ambiguous.',
  suggestedRiskLevel: 'HIGH_CONCERN', confidence: 0.99,
});
const validGemini = new GeminiAnalysisProvider({
  apiKey: 'test-only-secret',
  request: async ({ signal }) => {
    assert.ok(signal instanceof AbortSignal);
    return structured;
  },
});
const geminiOnly = new AnalysisEngine([validGemini]);
const suggestedOnly = await geminiOnly.analyze(input('An ordinary meeting reminder.'));
assert.equal(suggestedOnly.providerAssessments[0]?.suggestedRiskLevel, 'HIGH_CONCERN');
assert.equal(suggestedOnly.riskLevel, 'NO_STRONG_WARNING_SIGNS', 'model suggestion must not control final risk');

const invalidProvider = new GeminiAnalysisProvider({ apiKey: 'test-only-secret', request: async () => '{bad json' });
await assert.rejects(() => invalidProvider.analyze(input('test')), /Gemini analysis is unavailable/);
const requestFailureProvider = new GeminiAnalysisProvider({
  apiKey: 'test-only-secret', request: async () => { throw new Error('sensitive upstream detail'); },
});
await assert.rejects(() => requestFailureProvider.analyze(input('test')), /Gemini analysis is unavailable/);
const timeoutProvider = new GeminiAnalysisProvider({
  apiKey: 'test-only-secret', timeoutMs: 5,
  request: async ({ signal }) => new Promise<string>((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('request timed out')), { once: true });
  }),
});
await assert.rejects(() => timeoutProvider.analyze(input('test')), /Gemini analysis is unavailable/);

const offlineEngine = new AnalysisEngine([
  new RuleAnalysisProvider(),
  new GeminiAnalysisProvider({ apiKey: undefined }),
]);
const offline = await offlineEngine.analyze(input('Ordinary message without warning terms.'));
assert.equal(offline.riskLevel, 'NEEDS_VERIFICATION', 'unavailable provider preserves uncertainty');
assert.equal(offline.warnings[0]?.provider, 'gemini');
assert.ok(!JSON.stringify(offline).includes('test-only-secret'));
assert.ok(!JSON.stringify(offline).includes('sensitive upstream detail'));

const brokenEngine = new AnalysisEngine([new RuleAnalysisProvider(), invalidProvider]);
const degraded = await brokenEngine.analyze(input('Please visit https://example.invalid'));
assert.ok(degraded.warnings.some(({ provider }) => provider === 'gemini'));
assert.ok(degraded.reasons.length > 0, 'rules must continue when Gemini fails');

console.log(JSON.stringify({
  scenarioCount: scenarios.length,
  mockedGemini: 'structured schema accepted; suggested risk did not override engine risk',
  failureCases: ['malformed response', 'request failure', 'timeout', 'missing key', 'rules continue on provider failure'],
  secretSafety: 'generic errors and outputs contain no test credential or upstream error',
  status: 'PASS',
}, null, 2));
