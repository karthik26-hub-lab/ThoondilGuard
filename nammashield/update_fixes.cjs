const fs = require('fs');
const path = require('path');

const baseDir = "C:\\\\Users\\\\KARTHIK\\\\Desktop\\\\rec\\\\nammashield";

const files = {
    "src/lib/detector.ts": `export type RiskLevel = 'No strong warning signs found' | 'Needs verification' | 'High concern';

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
  let redacted = text.replace(/\\b\\d{10}\\b/g, '[PHONE REDACTED]');
  redacted = redacted.replace(/\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b/g, '[EMAIL REDACTED]');
  redacted = redacted.replace(/\\b\\d{4,9}\\b/g, '[NUMBER REDACTED]');
  redacted = redacted.replace(/\\b\\d{11,}\\b/g, '[NUMBER REDACTED]');
  return redacted;
}

export function detectFraud(text: string): DetectionResult {
  const lowerText = text.toLowerCase();
  const findings: string[] = [];
  const actions: string[] = [];
  let score = 0;

  // 1. URLs
  const urlRegex = /(https?:\\/\\/[^\\s]+)|(www\\.[^\\s]+)/g;
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
  const sharingKeywords = ['share', 'send', 'forward', 'give', 'call', 'reply'];
  const asksToShare = sharingKeywords.some(k => lowerText.includes(k));
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
`,
    "src/lib/storage.ts": `import { redactPII } from './detector';

export interface Report {
  id: string;
  originalText: string;
  region: string;
  category: string;
  context?: string;
  timestamp: string;
  riskLevel: string;
  isSeed?: boolean;
}

const SEED_DATA: Report[] = [
  {
    id: 'seed-1',
    originalText: 'Dear customer, your EB Bill is pending. Update your KYC via http://update-eb-bill.com to avoid disconnection [PHONE REDACTED]',
    region: 'Chennai',
    category: 'Electricity Bill Scam',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    riskLevel: 'High concern',
    isSeed: true
  },
  {
    id: 'seed-2',
    originalText: 'Congratulations! You won ₹10,000 in lucky draw. Click bit.ly/win-prize to claim.',
    region: 'Coimbatore',
    category: 'Lottery/Prize',
    timestamp: new Date(Date.now() - 172800000).toISOString(),
    riskLevel: 'High concern',
    isSeed: true
  }
];

export function getReports(): Report[] {
  try {
    const data = localStorage.getItem('nammashield_reports');
    if (!data) return SEED_DATA;
    const parsed = JSON.parse(data);
    return [...parsed, ...SEED_DATA];
  } catch {
    return SEED_DATA;
  }
}

export function saveReport(report: Omit<Report, 'id' | 'timestamp' | 'isSeed'>): void {
  const reports = getReports().filter(r => !r.isSeed);
  const newReport = {
    ...report,
    // Enforce redaction strictly at the storage boundary
    originalText: redactPII(report.originalText),
    id: \`rep-\${Date.now()}-\${Math.random().toString(36).substring(2, 9)}\`,
    timestamp: new Date().toISOString(),
    isSeed: false
  };
  reports.unshift(newReport);
  localStorage.setItem('nammashield_reports', JSON.stringify(reports));
}
`,
    "src/pages/Report.tsx": `import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GlassCard } from '../components/GlassCard';
import { saveReport } from '../lib/storage';
import { redactPII } from '../lib/detector';
import { ShieldCheck, Info } from 'lucide-react';

const REGIONS = ['Chennai', 'Coimbatore', 'Madurai', 'Trichy', 'Salem', 'Tirunelveli', 'Other (Tamil Nadu)'];
const CATEGORIES = ['Phishing Link', 'Job/Task Scam', 'Electricity Bill Scam', 'Loan App Harassment', 'Lottery/Prize', 'Other'];

export function Report() {
  const location = useLocation();
  const navigate = useNavigate();
  const [text, setText] = useState(location.state?.text || '');
  const [region, setRegion] = useState('');
  const [category, setCategory] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    // Component mounted
  }, [text, location.state]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text || !region || !category) return;

    saveReport({
      originalText: text,
      region,
      category,
      riskLevel: location.state?.risk || 'User Reported',
    });
    
    setSubmitted(true);
    setTimeout(() => {
      navigate('/alerts');
    }, 2000);
  };

  const redactedPreview = text ? redactPII(text) : '';

  if (submitted) {
    return (
      <div className="text-center py-16">
        <GlassCard className="p-8 inline-block text-left max-w-md w-full border-green-200 bg-green-50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-200 text-green-700 rounded-full flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-green-900">Report Submitted</h2>
          </div>
          <p className="text-green-800">Thank you. Your report is anonymous and will help warn others in your region.</p>
          <p className="text-sm text-green-700 mt-4 opacity-80">Redirecting to alerts...</p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 text-stone-900">Report a Scam</h1>
        <p className="text-stone-600 text-lg">Submit suspicious messages to help protect your community.</p>
      </div>

      <GlassCard className="p-5 md:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div>
            <label className="block text-base font-bold text-stone-900 mb-2" htmlFor="report-text">
              Suspicious Message or Link
            </label>
            <p className="text-sm text-stone-600 mb-3 flex items-start gap-1.5">
              <Info className="w-4 h-4 shrink-0 mt-0.5" /> 
              Please do not enter passwords or live OTPs. We attempt to mask sensitive info like phone numbers and codes automatically, but no system is perfect.
            </p>
            <textarea
              id="report-text"
              required
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full h-28 p-3 rounded-md border border-stone-300 bg-white focus:ring-2 focus:ring-blue-700 outline-none resize-none text-stone-900"
              placeholder="Paste the suspicious content here..."
            />
            
            {text && (
              <div className="mt-4 p-4 bg-stone-50 rounded-md border border-stone-200">
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Review your masked report (This is what gets saved):</label>
                <p className="text-sm text-stone-800 whitespace-pre-wrap font-mono break-words">{redactedPreview}</p>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-bold text-stone-900 mb-2" htmlFor="region-select">Your Region (Tamil Nadu)</label>
              <select 
                id="region-select"
                required
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full p-3 rounded-md border border-stone-300 bg-white focus:ring-2 focus:ring-blue-700 outline-none text-stone-900"
              >
                <option value="" disabled>Select Region</option>
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-stone-900 mb-2" htmlFor="category-select">Scam Category</label>
              <select 
                id="category-select"
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-3 rounded-md border border-stone-300 bg-white focus:ring-2 focus:ring-blue-700 outline-none text-stone-900"
              >
                <option value="" disabled>Select Category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="w-full min-h-[48px] bg-blue-700 hover:bg-blue-800 text-white py-3 rounded-md font-bold transition-colors focus:outline-none focus:ring-4 focus:ring-blue-300"
          >
            Submit Report Anonymously
          </button>
        </form>
      </GlassCard>
    </div>
  );
}
`
};

for (const [filepath, content] of Object.entries(files)) {
    const fullPath = path.join(baseDir, filepath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
}
console.log("Scaffolded JS script completed.");
