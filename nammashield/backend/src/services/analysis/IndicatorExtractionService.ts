import { domainToASCII } from 'node:url';
import type {
  AnalysisIndicator,
  AnalysisSignal,
  AnalysisUrl,
  NormalizedAnalysisIndicator,
} from '../../types/analysis.js';

const EMAIL_PATTERN = /(?<![\w.+-])[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/giu;
const PHONE_PATTERN = /(?<![\w@])\+?(?:\d[\s().-]*){9,14}\d(?!\w)/gu;
const UPI_CONTEXT_PATTERN = /\b(?:upi(?:\s*(?:id|address))?|vpa)\s*[:=-]?\s*([a-z0-9][a-z0-9._-]{1,63}@[a-z][a-z0-9.-]{1,63})/giu;
const UPI_HANDLE_PATTERN = /\b[a-z0-9][a-z0-9._-]{1,63}@(okaxis|okhdfcbank|oksbi|okicici|ybl|ibl|axl|apl|paytm|upi|phonepe|gpay|sbi|hdfcbank|axisbank|icici|kotak)\b/giu;

const SUSPICIOUS_PHRASES: readonly RegExp[] = [
  /\b(?:send|share|provide|enter|reply\s+with|confirm)\s+(?:your\s+)?(?:otp|password|passcode|pin|verification\s+code|aadhaar|aadhar|pan(?:\s+card)?)\b/giu,
  /\b(?:otp|password|pin)\s+(?:anuppunga|anuppu|share\s+pannunga|sollunga)\b/giu,
  /\b(?:account|connection|parcel|electricity)\b.{0,45}\b(?:closed|blocked|suspended|disconnected|disconnect|power\s+cut|current\s+cut|aagum|poidum)\b/giu,
  /\b(?:pay|transfer|deposit|gpay)\b.{0,45}\b(?:now|immediately|urgent|fee|upi|rupees?|rs\.?|₹)\b/giu,
  /\b(?:install|download)\b.{0,35}\b(?:apk|app|application)\b/giu,
  /\b(?:claim|unlock|receive)\b.{0,35}\b(?:reward|refund|cashback|prize|commission)\b/giu,
];

export interface IndicatorExtractionInput {
  text: string;
  urls: readonly AnalysisUrl[];
  signals: readonly AnalysisSignal[];
  providerIndicators: readonly AnalysisIndicator[];
}

export class IndicatorExtractionService {
  extract(input: IndicatorExtractionInput): NormalizedAnalysisIndicator[] {
    const indicators = new Map<string, NormalizedAnalysisIndicator>();
    const add = (
      type: AnalysisIndicator['type'],
      value: string,
      normalizedValue: string,
      source: AnalysisIndicator['source'],
      confidence: number,
      evidence: string,
    ): void => {
      const original = value.trim();
      const normalized = normalizedValue.trim();
      if (!original || !normalized || indicators.size >= 100) return;
      const key = `${type}:${normalized.toLowerCase()}`;
      if (!indicators.has(key)) {
        indicators.set(key, { type, value: original.slice(0, 2_048), normalizedValue: normalized.slice(0, 2_048), source, confidence, evidence: evidence.slice(0, 500) });
      }
    };

    for (const url of input.urls) {
      const supportingSignal = url.signals[0];
      const evidence = supportingSignal?.description ?? 'URL extracted from submitted text; destination was not visited.';
      add('URL', url.url, url.normalizedUrl, 'url', 0.95, evidence);
      add('DOMAIN', url.domain, domainToASCII(url.domain).toLowerCase(), 'url', 0.95, `Host parsed from ${url.normalizedUrl}.`);
    }

    const explicitUpiIds = new Set([...input.text.matchAll(UPI_CONTEXT_PATTERN)]
      .map((match) => match[1]?.toLowerCase())
      .filter((value): value is string => Boolean(value)));
    for (const match of input.text.matchAll(EMAIL_PATTERN)) {
      const value = match[0];
      const normalized = value.trim().toLowerCase();
      if (explicitUpiIds.has(normalized)) continue;
      add('EMAIL', value, normalized, 'rule', 0.9, 'Email-like address extracted from submitted text.');
    }

    const upis = new Map<string, string>();
    for (const match of input.text.matchAll(UPI_CONTEXT_PATTERN)) {
      const value = match[1];
      if (value) upis.set(value.toLowerCase(), value);
    }
    for (const match of input.text.matchAll(UPI_HANDLE_PATTERN)) {
      const value = match[0];
      upis.set(value.toLowerCase(), value);
    }
    for (const [normalized, value] of upis) {
      add('UPI_ID', value, normalized, 'rule', 0.85, 'UPI/VPA-like identifier extracted from submitted text.');
    }

    for (const match of input.text.matchAll(PHONE_PATTERN)) {
      const value = match[0].trim();
      const digits = value.replace(/\D/gu, '');
      if (digits.length < 10 || digits.length > 15) continue;
      const normalized = `${value.startsWith('+') ? '+' : ''}${digits}`;
      add('PHONE', value, normalized, 'rule', 0.72, 'Phone-like number normalized without adding a country code.');
    }

    for (const pattern of SUSPICIOUS_PHRASES) {
      for (const match of input.text.matchAll(pattern)) {
        const value = match[0].trim();
        if (!value || match.index === undefined) continue;
        const contextBefore = input.text.slice(Math.max(0, match.index - 45), match.index);
        if (/(?:never|don't|dont|do\s+not|avoid)\W{0,35}$/iu.test(contextBefore)) continue;
        add('PHRASE', value, value.toLowerCase().replace(/\s+/gu, ' '), 'rule', 0.72, 'Matched an explainable action/pressure phrase in submitted text.');
      }
    }

    for (const indicator of input.providerIndicators) {
      if (indicator.type === 'URL' || indicator.type === 'DOMAIN') continue;
      const value = indicator.value.trim();
      if (!value || !input.text.toLowerCase().includes(value.toLowerCase())) continue;
      let normalizedValue = value;
      if (indicator.type === 'PHONE') {
        const digits = value.replace(/\D/gu, '');
        if (digits.length < 10 || digits.length > 15) continue;
        normalizedValue = `${value.startsWith('+') ? '+' : ''}${digits}`;
      } else if (indicator.type === 'EMAIL' || indicator.type === 'UPI_ID') {
        normalizedValue = value.toLowerCase().replace(/\s+/gu, '');
      } else if (indicator.type === 'PHRASE') {
        normalizedValue = value.toLowerCase().replace(/\s+/gu, ' ');
      }
      const support = input.signals.find(({ indicators: signalIndicators }) =>
        signalIndicators?.some(({ type, value: signalValue }) => type === indicator.type && signalValue === value),
      );
      const evidence = support?.evidence[0]?.description ?? 'Provider-extracted indicator matched the submitted text.';
      add(indicator.type, value, normalizedValue, indicator.source, 0.65, evidence);
    }

    return [...indicators.values()];
  }
}
