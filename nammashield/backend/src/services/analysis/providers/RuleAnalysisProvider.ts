import type { AnalysisInput, AnalysisSignal } from '../../../types/analysis.js';
import type { AnalysisProvider } from './AnalysisProvider.js';

const credentialTerms = '(?:password|otp|passcode|pin|verification code|one[- ]time (?:password|code))';
const requestVerbs = '(?:send|share|provide|enter|reply(?: with)?|confirm|tell (?:me|us)|give (?:me|us)|anuppunga|anuppu|share pannunga|sollunga)';
const requestActionPattern = new RegExp(`\\b${requestVerbs}\\b`, 'i');
const credentialRequestPattern = new RegExp(`\\b${requestVerbs}\\b.{0,60}\\b${credentialTerms}\\b|\\b${credentialTerms}\\b.{0,60}\\b${requestVerbs}\\b|\\b(?:otp|password|pin)\\b.{0,35}\\b(?:ready|vachukonga|share pannunga|anuppunga)\\b`, 'i');
const credentialNegationPattern = /\b(?:never|do not|don't|dont|avoid|not required to)\b.{0,80}\b(?:share|send|provide|reveal|give|disclose)\b.{0,60}\b(?:password|otp|passcode|pin|verification code|one[- ]time (?:password|code)|aadhaar|aadhar|pan(?: card)?|bank details|card details)\b|\b(?:otp|password|pin|aadhaar|aadhar|pan(?: card)?)\b.{0,40}\b(?:share|send|provide)\b.{0,25}\b(?:pannadhe|pannathe|panna koodathu|panna koodadhu)\b/gi;
const paymentRequestPattern = /\b(?:pay|send|transfer|deposit|submit|gpay)\b.{0,60}(?:₹|\b(?:rs\.?|rupees?|money|payment|fee|upi|amount)\b)|(?:₹|\brs\.?\s?)\s?[\d,]+.{0,60}\b(?:pay|pannunga|pannitu|kattunga|anuppunga|send|transfer|deposit|gpay)\b|\b(?:payment|fee)\b.{0,50}\b(?:immediately|now|urgent|transfer|pay)\b/i;
const paymentNegationPattern = /\b(?:never|do not|don't|dont|avoid)\b.{0,40}\b(?:pay|send|transfer|deposit)\b.{0,60}(?:₹|\brs\.?|money|payment|fee|upi|amount)\b/gi;
const urgencyPattern = /\b(?:urgent(?:ly)?|immediately|act now|within \d+ (?:minutes?|hours?)|account.{0,20}(?:blocked|suspended)|final warning|arrest|legal action|udane|ippove|ippo|avacaram|illana|illatti)\b/i;
const threatPattern = /\b(?:power cut|current cut|line cut|disconnect(?:ed|ion)?|suspend(?:ed)?|block(?:ed)?|police case|case file|legal action|arrest|return(?:ed)?|account.{0,20}closed|aagum|poidum)\b/i;
const sensitiveRequestPattern = /\b(?:aadhaar|aadhar|pan(?: card)?|kyc|bank details|card details|identity proof)\b.{0,60}\b(?:send|share|provide|upload|text|whatsapp|anuppunga|share pannunga)\b|\b(?:send|share|provide|upload|text|whatsapp|anuppunga|share pannunga)\b.{0,60}\b(?:aadhaar|aadhar|pan(?: card)?|kyc|bank details|card details|identity proof)\b/i;
const apkPattern = /(?:\.apk\b|\b(?:install|download)\b.{0,40}\b(?:app|application|apk)\b|\b(?:app|application)\b.{0,40}\b(?:install|download)\b)/i;
const rewardPattern = /\b(?:claim|receive|unlock|credited|refund|reward|prize|cashback|commission)\b.{0,60}\b(?:click|pay|fee|upi|link|deposit|otp|claim)\b|\b(?:pay|deposit|share|send)\b.{0,50}\b(?:fee|deposit|commission|reward|prize|refund)\b/i;
const offPlatformPattern = /\b(?:whatsapp|telegram|t\.me|wa\.me)\b.{0,50}\b(?:only|contact|message|call|join|dm|send)\b|\b(?:contact|message|call|join|dm)\b.{0,50}\b(?:whatsapp|telegram|t\.me|wa\.me)\b/i;
const impersonationPattern = /\b(?:from|speaking on behalf of)\b.{0,45}\b(?:bank|customer care|electricity department|tneb|tangedco|customs|police|post office|courier)\b|\b(?:bank|customer care|electricity department|tneb|tangedco|customs|police|post office|courier)\b.{0,25}\b(?:officer|official|department|customer care)\b/i;
const contactNumberPattern = /\b(?:call|contact|text|whatsapp)\b.{0,45}\b[6-9]\d{4}x{5}\b/i;
const linkLikePattern = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|in|info|xyz|click|top)\b/i;

function signal(
  category: AnalysisSignal['reason']['category'],
  message: string,
  severity: AnalysisSignal['reason']['severity'],
  evidenceDescription: string,
  evidenceType: AnalysisSignal['evidence'][number]['type'] = 'text_pattern',
): AnalysisSignal {
  return {
    reason: { category, message, severity, source: 'rule' },
    evidence: [{ type: evidenceType, description: evidenceDescription, source: 'rule' }],
  };
}

export class RuleAnalysisProvider implements AnalysisProvider {
  readonly name = 'deterministic-baseline-rules';

  analyze(input: AnalysisInput) {
    const text = [input.content, input.extractedText, input.url]
      .filter((value): value is string => Boolean(value?.trim()))
      .join('\n');
    if (!text) return { signals: [] };

    const signals: AnalysisSignal[] = [];
    const credentialSafeText = text.replace(credentialNegationPattern, ' ');
    const paymentSafeText = text.replace(paymentNegationPattern, ' ');

    if (credentialRequestPattern.test(credentialSafeText)) {
      signals.push(signal(
        'credential_request',
        'The message appears to request a password, OTP, PIN, or verification code.',
        'high',
        'Credential-sharing request language matched a baseline rule.',
      ));
    }

    if (paymentRequestPattern.test(paymentSafeText)) {
      signals.push(signal(
        'payment_request',
        'The message appears to request a payment or money transfer.',
        'medium',
        'Payment-request language matched a baseline rule.',
      ));
    }

    if (urgencyPattern.test(text)) {
      signals.push(signal(
        'urgency',
        'Urgent or pressuring language was detected.',
        'medium',
        'Urgency or pressure language matched a baseline rule.',
      ));
    }

    if (threatPattern.test(text)) {
      signals.push(signal(
        'threat_or_pressure',
        'Threatening or coercive language was detected.',
        'medium',
        'Threat or consequence language matched a baseline rule.',
      ));
    }

    if (sensitiveRequestPattern.test(credentialSafeText)) {
      signals.push(signal(
        'request_for_sensitive_information',
        'The message may be requesting identity or financial information.',
        'medium',
        'A sensitive-information term appeared with request language.',
      ));
    }

    if (apkPattern.test(text)) {
      signals.push(signal(
        'apk_installation',
        'The message refers to installing or downloading an app or APK.',
        'medium',
        'App-installation or APK language matched a baseline rule.',
      ));
    }

    if (rewardPattern.test(text)) {
      signals.push(signal(
        'fake_reward_or_refund',
        'Reward, refund, or commission language appeared with a requested action.',
        'medium',
        'A reward/refund offer and action language matched a baseline rule.',
      ));
    }

    if (impersonationPattern.test(text) && (requestActionPattern.test(text) || paymentRequestPattern.test(paymentSafeText))) {
      signals.push(signal(
        'impersonation',
        'The message combines an organization or authority claim with a requested action.',
        'medium',
        'Organization-claim and request patterns appeared together.',
      ));
    }

    if (offPlatformPattern.test(text) || contactNumberPattern.test(text)) {
      signals.push(signal(
        'off_platform_contact',
        'The message directs contact through an external messaging platform.',
        'low',
        'A WhatsApp or Telegram contact instruction matched a baseline rule.',
      ));
    }

    if (linkLikePattern.test(text)) {
      signals.push(signal(
        'suspicious_link',
        'A link-like value was present; this check does not assess its destination.',
        'low',
        'A URL-like text pattern was present; no reputation lookup was performed.',
        'url_pattern',
      ));
    }

    return { signals };
  }
}
