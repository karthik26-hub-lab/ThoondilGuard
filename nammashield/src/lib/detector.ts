export type RiskLevel = 'No strong warning signs found' | 'Needs verification' | 'High concern';

export interface DetectionResult {
  riskLevel: RiskLevel;
  findings: string[];
  actions: string[];
}

const URGENCIES = ['urgent', 'immediate', 'act fast', 'suspended', 'blocked', 'warning', 'expires', 'limit exceeded', 'action required', 'udane', 'udanae', 'vuraivil'];
const SENSITIVE_INFO = ['password', 'pin', 'bank account', 'click here to pay', 'credit card', 'debit card', 'vangi kanaku', 'kadan', 'kyc'];
const OTP_KEYWORDS = ['otp', 'one time password'];
const SUSPICIOUS_URL_PATTERNS = ['bit.ly', 't.co', 'tinyurl', 'free-prize', 'update-sbi', 'claim-now', '.xyz', '.top', 'jio-free'];

export function redactPII(text: string): string {
  let redacted = text.replace(/\b\d{10}\b/g, '[PHONE REDACTED]');
  redacted = redacted.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL REDACTED]');
  redacted = redacted.replace(/\b\d{4,9}\b/g, '[NUMBER REDACTED]');
  redacted = redacted.replace(/\b\d{11,}\b/g, '[NUMBER REDACTED]');
  return redacted;
}

export function detectFraud(text: string): DetectionResult {
  const lowerText = text.toLowerCase();
  const findings: string[] = [];
  const actions: string[] = [];
  let score = 0;

  // 1. URLs
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/g;
  const urls = lowerText.match(urlRegex) || [];
  
  if (urls.length > 0) {
    let badUrlFound = false;
    urls.forEach(url => {
      if (SUSPICIOUS_URL_PATTERNS.some(pattern => url.includes(pattern))) {
        badUrlFound = true;
      }
    });
    
    if (badUrlFound) {
      findings.push("Contains a disguised or unusual link often used to steal information.");
      score += 50;
    } else {
      findings.push("Contains a web link. Links in unexpected messages should be treated with caution.");
      score += 20;
    }
  }

  // 2. Urgency
  const hasUrgency = URGENCIES.some(u => lowerText.includes(u));
  if (hasUrgency) {
    findings.push("Uses urgent language (like 'suspended' or 'immediate') to pressure you into acting quickly.");
    score += 30;
  }

  // 3. Credentials & Payments
  const hasSensitive = SENSITIVE_INFO.some(c => lowerText.includes(c));
  if (hasSensitive) {
    findings.push("Asks for sensitive information or payment details (like bank info or KYC updates).");
    score += 40;
  }

  // 4. OTPs specifically
  const hasOtp = OTP_KEYWORDS.some(c => lowerText.includes(c));
  
  // Look for sharing requests, but ignore common legitimate phrases like "do not share"
  const textWithoutDoNotShare = lowerText.replace(/do not share/g, '').replace(/don't share/g, '').replace(/never share/g, '');
  const sharingKeywords = ['share', 'send', 'forward', 'give ', 'call', 'reply'];
  const asksToShare = sharingKeywords.some(k => textWithoutDoNotShare.includes(k));
  
  let isHighRiskOtp = false;
  let isPlainOtp = false;

  if (hasOtp) {
    // If it asks to share, has links, or already has high urgency/threats
    if (urls.length > 0 || asksToShare || hasUrgency) {
      isHighRiskOtp = true;
      findings.push("Mentions an OTP alongside suspicious links or requests to share it. Scammers trick people into sharing these codes to steal accounts.");
      score += 50;
    } else {
      isPlainOtp = true;
      findings.push("Contains a verification code (OTP). We cannot confirm who sent this or if you requested it.");
    }
  }

  // Determine Risk Level
  let riskLevel: RiskLevel = 'No strong warning signs found';
  if (score >= 50 || isHighRiskOtp) {
    riskLevel = 'High concern';
  } else if (score >= 30 || isPlainOtp) {
    riskLevel = 'Needs verification';
  }

  // Provide actions based on risk
  if (riskLevel === 'High concern') {
    actions.push("Do not click any links or reply to the message.");
    actions.push("If it claims to be from your bank or a known service, contact them directly using their official app or website, not the details in this message.");
  } else if (riskLevel === 'Needs verification') {
    if (isPlainOtp) {
      actions.push("Enter this code only in the official app or website you opened yourself.");
      actions.push("Never share it with another person, even if they claim to be support.");
    } else {
      actions.push("Verify the sender before taking any action.");
      actions.push("Log in to the official service directly if you need to check your account status.");
    }
  } else {
    if (findings.length === 0) {
      findings.push("We didn't detect common scam patterns in this text.");
    }
    actions.push("If you weren't expecting this message, remain cautious.");
  }

  return { riskLevel, findings, actions };
}
