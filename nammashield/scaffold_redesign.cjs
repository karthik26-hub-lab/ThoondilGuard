const fs = require('fs');
const path = require('path');

const baseDir = "C:\\\\Users\\\\KARTHIK\\\\Desktop\\\\rec\\\\nammashield";

const files = {
    "src/index.css": `@import "tailwindcss";

@theme {
  --color-glass-light: rgba(255, 255, 255, 0.95);
  --color-glass-border: rgba(0, 0, 0, 0.05);
  --shadow-glass: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
}

@layer base {
  body {
    @apply bg-stone-50 text-stone-900 antialiased selection:bg-blue-200;
    min-height: 100vh;
  }
}
`,
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
  if (hasOtp) {
    if (score === 0) {
      // Just an OTP, no URL, no urgency, no bank requests. Very likely an ordinary legitimate OTP.
      findings.push("Contains a verification code (OTP). This is normal if you just requested one.");
      score += 0;
    } else {
      findings.push("Mentions an OTP alongside other warning signs. Scammers often trick people into sharing these codes.");
      score += 20;
    }
  }

  // Determine Risk Level
  let riskLevel: RiskLevel = 'No strong warning signs found';
  if (score >= 50) riskLevel = 'High concern';
  else if (score >= 30) riskLevel = 'Needs verification';

  // Provide actions based on risk
  if (riskLevel === 'High concern') {
    actions.push("Do not click any links or reply to the message.");
    actions.push("If it claims to be from your bank or a known service, contact them directly using their official app or website, not the details in this message.");
  } else if (riskLevel === 'Needs verification') {
    actions.push("Verify the sender before taking any action.");
    actions.push("Log in to the official service directly if you need to check your account status.");
  } else {
    if (findings.length === 0) {
      findings.push("We didn't detect common scam patterns in this text.");
    }
    actions.push("If you weren't expecting this message, remain cautious.");
    if (hasOtp) {
      actions.push("Never share your OTP with anyone, even if they claim to be customer support.");
    }
  }

  return { riskLevel, findings, actions };
}
`,
    "src/lib/storage.ts": `export interface Report {
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
    id: \`rep-\${Date.now()}-\${Math.random().toString(36).substring(2, 9)}\`,
    timestamp: new Date().toISOString(),
    isSeed: false
  };
  reports.unshift(newReport);
  localStorage.setItem('nammashield_reports', JSON.stringify(reports));
}
`,
    "src/components/GlassCard.tsx": `import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

export function GlassCard({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  // Removed framer-motion animations to respect "subtle, fast motion" and "reduced-motion" settings natively
  // Removed heavy glass effects, replacing with solid high-contrast backgrounds
  return (
    <div
      className={cn(
        "bg-white border border-stone-200 shadow-sm rounded-xl overflow-hidden transition-shadow duration-200",
        className
      )}
    >
      {children}
    </div>
  );
}
`,
    "src/components/Layout.tsx": `import { Link, Outlet, useLocation } from 'react-router-dom';
import { ShieldCheck, Search, Bell, AlertTriangle, Menu, X, Info, MessageCircle, BarChart3 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../lib/utils';

export function Layout() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { path: '/', icon: Search, label: 'Check' },
    { path: '/alerts', icon: Bell, label: 'Local Alerts' },
    { path: '/report', icon: AlertTriangle, label: 'Report' },
    { path: '/about', icon: Info, label: 'About' },
  ];

  return (
    <div className="min-h-screen flex flex-col font-sans bg-stone-50">
      <header className="sticky top-0 z-50 bg-white border-b border-stone-200">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-700 rounded-md" onClick={() => setMobileMenuOpen(false)}>
            <div className="bg-blue-700 p-1.5 rounded text-white">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight text-stone-900">NammaShield</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex gap-4 items-center">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-700",
                    isActive ? "bg-stone-100 text-stone-900" : "text-stone-600 hover:text-stone-900 hover:bg-stone-50"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
            
            <Link 
              to="/chat" 
              className="ml-2 flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-700"
            >
              <MessageCircle className="w-4 h-4" />
              Ask for help
            </Link>
          </nav>

          {/* Mobile menu toggle */}
          <button 
            className="md:hidden p-2 text-stone-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <nav className="md:hidden bg-white border-t border-stone-100 px-4 py-4 flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "px-4 py-3 rounded-md text-base font-medium flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-blue-700",
                    isActive ? "bg-stone-100 text-stone-900" : "text-stone-600 hover:bg-stone-50"
                  )}
                >
                  <item.icon className="w-5 h-5 text-stone-500" />
                  {item.label}
                </Link>
              );
            })}
            <Link
              to="/chat"
              onClick={() => setMobileMenuOpen(false)}
              className="mt-2 px-4 py-3 rounded-md text-base font-medium flex items-center gap-3 text-blue-700 bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-700"
            >
              <MessageCircle className="w-5 h-5" />
              Ask for help
            </Link>
          </nav>
        )}
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-6 md:py-10">
        <Outlet />
      </main>

      <footer className="bg-white border-t border-stone-200 py-8 mt-auto">
        <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between text-sm text-stone-500">
          <div>
            <p className="font-medium text-stone-700">NammaShield Prototype</p>
            <p className="mt-1">A civic-safety tool for demonstration. Not a replacement for official police reporting.</p>
          </div>
          <div className="mt-4 md:mt-0">
            <Link to="/analyst" className="inline-flex items-center gap-1.5 text-stone-500 hover:text-stone-800 transition-colors focus:outline-none focus:ring-2 focus:ring-stone-500 rounded px-1 py-0.5">
              <BarChart3 className="w-4 h-4" /> Analyst Demo
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
`,
    "src/pages/Home.tsx": `import { useState, useEffect } from 'react';
import { GlassCard } from '../components/GlassCard';
import { detectFraud, redactPII } from '../lib/detector';
import type { DetectionResult } from '../lib/detector';
import { AlertTriangle, Info, ArrowRight, ShieldAlert, CheckCircle2, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Home() {
  const [input, setInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [redactedText, setRedactedText] = useState('');
  const navigate = useNavigate();

  const handleCheck = () => {
    if (!input.trim()) return;
    setIsAnalyzing(true);
    setResult(null);
    
    setTimeout(() => {
      const res = detectFraud(input);
      setResult(res);
      setRedactedText(redactPII(input));
      setIsAnalyzing(false);
    }, 600); // Shorter, purposeful delay
  };

  const loadExample = (type: 'phishing' | 'otp' | 'safe') => {
    if (type === 'phishing') setInput("Dear customer, your bank account is suspended. Update KYC immediately via http://sbi-update-kyc.xyz or act fast to avoid charges.");
    if (type === 'otp') setInput("Your login OTP is 492011. Do not share this with anyone.");
    if (type === 'safe') setInput("Hi Ramesh, let's meet at the coffee shop at 5 PM tomorrow.");
    setResult(null);
  };

  const getRiskStyles = (level: string) => {
    if (level === 'High concern') return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-900', icon: <ShieldAlert className="w-8 h-8 text-red-700" /> };
    if (level === 'Needs verification') return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900', icon: <AlertTriangle className="w-8 h-8 text-amber-700" /> };
    return { bg: 'bg-stone-100', border: 'border-stone-200', text: 'text-stone-800', icon: <Info className="w-8 h-8 text-stone-600" /> };
  };

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold text-stone-900 mb-2">Check suspicious messages or links</h1>
        <p className="text-stone-600 text-lg">
          Paste a message you received to check for common warning signs of fraud.
        </p>
      </section>

      <GlassCard className="p-4 md:p-6 shadow-sm">
        <label htmlFor="message-input" className="block text-sm font-bold text-stone-900 mb-2">
          Message or Link to check
        </label>
        <div className="relative">
          <textarea
            id="message-input"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setResult(null);
            }}
            placeholder="Paste your message here..."
            className="w-full h-32 p-4 rounded-md border border-stone-300 bg-white focus:ring-2 focus:ring-blue-700 focus:border-blue-700 outline-none resize-none text-base text-stone-800"
          />
        </div>
        
        <div className="mt-4 mb-6">
          <span className="text-sm font-medium text-stone-600 block mb-2">Try an example:</span>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => loadExample('phishing')} className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-medium rounded border border-stone-200 focus:outline-none focus:ring-2 focus:ring-blue-700 transition-colors">Suspicious message</button>
            <button onClick={() => loadExample('otp')} className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-medium rounded border border-stone-200 focus:outline-none focus:ring-2 focus:ring-blue-700 transition-colors">Ordinary OTP</button>
            <button onClick={() => loadExample('safe')} className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-medium rounded border border-stone-200 focus:outline-none focus:ring-2 focus:ring-blue-700 transition-colors">Ordinary message</button>
          </div>
        </div>

        <button
          onClick={handleCheck}
          disabled={!input.trim() || isAnalyzing}
          className="w-full min-h-[48px] bg-blue-700 hover:bg-blue-800 disabled:bg-blue-300 disabled:cursor-not-allowed text-white py-3 rounded-md font-bold text-base transition-colors flex justify-center items-center focus:outline-none focus:ring-4 focus:ring-blue-300"
        >
          {isAnalyzing ? 'Checking...' : 'Check this message'}
        </button>
        
        <p className="text-xs text-stone-500 mt-3 text-center flex items-center justify-center gap-1.5">
          <Info className="w-3.5 h-3.5" /> Privacy note: We don't save your text unless you choose to report it.
        </p>
      </GlassCard>

      {result && (
        <section aria-live="polite" className="scroll-mt-4" id="result-section">
          <div className={\`rounded-xl border \${getRiskStyles(result.riskLevel).border} \${getRiskStyles(result.riskLevel).bg} overflow-hidden\`}>
            <div className="p-5 md:p-6">
              <div className="flex items-start gap-4 mb-5">
                <div className="mt-1 shrink-0">
                  {getRiskStyles(result.riskLevel).icon}
                </div>
                <div>
                  <h2 className={\`text-xl md:text-2xl font-bold \${getRiskStyles(result.riskLevel).text}\`}>
                    {result.riskLevel}
                  </h2>
                  <p className="text-stone-700 mt-1 text-sm md:text-base font-medium">
                    This is an automated check, not a guaranteed verdict.
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6 border-t border-black/5 pt-5">
                <div>
                  <h3 className="font-bold text-stone-900 mb-3">What we found:</h3>
                  <ul className="space-y-2">
                    {result.findings.map((finding, idx) => (
                      <li key={idx} className="flex gap-2 text-stone-800 text-sm md:text-base">
                        <span className="text-stone-400 mt-0.5">•</span> 
                        <span>{finding}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-bold text-stone-900 mb-3">What you can do now:</h3>
                  <ul className="space-y-2">
                    {result.actions.map((action, idx) => (
                      <li key={idx} className="flex gap-2 text-stone-800 text-sm md:text-base">
                        <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="bg-white border-t border-stone-200 p-5 md:p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-stone-900">Help your community</h4>
                  <p className="text-sm text-stone-600 mt-1">Report this to warn others in your local area. Sensitive info is automatically masked.</p>
                </div>
                <button 
                  onClick={() => navigate('/report', { state: { text: redactedText, risk: result.riskLevel } })}
                  className="min-h-[44px] bg-stone-900 hover:bg-stone-800 text-white px-6 py-2.5 rounded-md font-semibold flex items-center justify-center gap-2 focus:outline-none focus:ring-4 focus:ring-stone-300 whitespace-nowrap transition-colors"
                >
                  Report this message <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="py-6 border-t border-stone-200 mt-8">
        <h2 className="text-lg font-bold text-stone-900 mb-4">How it works</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded border border-stone-200">
            <div className="text-sm font-bold text-blue-700 mb-1">Step 1</div>
            <p className="text-stone-700 text-sm">Paste the exact text or web link you received into the box above.</p>
          </div>
          <div className="bg-white p-4 rounded border border-stone-200">
            <div className="text-sm font-bold text-blue-700 mb-1">Step 2</div>
            <p className="text-stone-700 text-sm">Review the warning signs. We check for urgency, suspicious links, and common scam tactics.</p>
          </div>
          <div className="bg-white p-4 rounded border border-stone-200">
            <div className="text-sm font-bold text-blue-700 mb-1">Step 3</div>
            <p className="text-stone-700 text-sm">Decide what to do safely, and report it to alert your local community.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
`,
    "src/pages/Report.tsx": `import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GlassCard } from '../components/GlassCard';
import { saveReport } from '../lib/storage';
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
              We automatically hide likely phone numbers and emails to protect privacy. Please manually remove your name or passwords.
            </p>
            <textarea
              id="report-text"
              required
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full h-28 p-3 rounded-md border border-stone-300 bg-white focus:ring-2 focus:ring-blue-700 outline-none resize-none text-stone-900"
              placeholder="Paste the suspicious content here..."
            />
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
`,
    "src/pages/Alerts.tsx": `import { useState } from 'react';
import { GlassCard } from '../components/GlassCard';
import { getReports } from '../lib/storage';
import { MapPin, Tag, Clock } from 'lucide-react';

export function Alerts() {
  const allReports = getReports();
  const [filterRegion, setFilterRegion] = useState('All');
  
  const regions = ['All', ...Array.from(new Set(allReports.map(r => r.region)))];
  
  const filtered = allReports.filter(r => {
    return filterRegion === 'All' || r.region === filterRegion;
  });

  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr);
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
      Math.round((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      'day'
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2 text-stone-900">Local Alerts</h1>
          <p className="text-stone-600 text-lg">Recent suspicious messages reported by residents.</p>
        </div>
        
        <div className="w-full md:w-56">
          <label className="block text-sm font-bold text-stone-900 mb-2" htmlFor="region-filter">Filter by region</label>
          <select 
            id="region-filter"
            value={filterRegion}
            onChange={(e) => setFilterRegion(e.target.value)}
            className="w-full p-2.5 rounded-md border border-stone-300 bg-white focus:ring-2 focus:ring-blue-700 outline-none text-stone-900"
          >
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <GlassCard className="p-8 text-center text-stone-600 bg-stone-100 border-dashed">
            No reports found for this region yet.
          </GlassCard>
        ) : (
          filtered.map((report) => (
            <GlassCard key={report.id} className="p-5 hover:border-stone-300">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded bg-stone-100 text-stone-800">
                      <MapPin className="w-3.5 h-3.5" /> {report.region}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded bg-stone-100 text-stone-800">
                      <Tag className="w-3.5 h-3.5" /> {report.category}
                    </span>
                  </div>
                  {report.isSeed && (
                    <span className="text-[10px] uppercase tracking-wider font-bold text-stone-500 border border-stone-200 px-1.5 py-0.5 rounded">Sample Data</span>
                  )}
                </div>
                
                <div className="text-stone-900 text-base leading-relaxed break-words whitespace-pre-wrap">
                  "{report.originalText}"
                </div>
                
                <div className="text-xs text-stone-500 font-medium flex items-center gap-1.5 pt-2">
                  <Clock className="w-3.5 h-3.5" /> Reported {formatDate(report.timestamp)}
                </div>
              </div>
            </GlassCard>
          ))
        )}
      </div>
    </div>
  );
}
`,
    "src/pages/About.tsx": `import { GlassCard } from '../components/GlassCard';

export function About() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-stone-900 mb-2">About NammaShield</h1>
      
      <GlassCard className="p-6 md:p-8 space-y-4">
        <h2 className="text-xl font-bold text-stone-900">What is this?</h2>
        <p className="text-stone-700 leading-relaxed">
          NammaShield is a prototype community fraud early-warning system built for residents of Tamil Nadu. 
          Its goal is to provide a fast, accessible way to check suspicious messages and share them with the community.
        </p>

        <h2 className="text-xl font-bold text-stone-900 pt-4">Privacy first</h2>
        <p className="text-stone-700 leading-relaxed">
          We believe in protecting your data. When you check a message, the analysis happens directly in your browser. 
          If you choose to submit a report, our system automatically redacts sensitive information like phone numbers and emails before saving it.
        </p>
        
        <h2 className="text-xl font-bold text-stone-900 pt-4">This is a prototype</h2>
        <p className="text-stone-700 leading-relaxed">
          Please note that this is a demonstration product created for a hackathon. It does not replace official police reporting. 
          If you have been the victim of a financial crime, please contact your bank and the national cybercrime portal immediately.
        </p>
      </GlassCard>
    </div>
  );
}
`,
    "src/pages/Chat.tsx": `import { useState, useRef, useEffect } from 'react';
import { GlassCard } from '../components/GlassCard';
import { detectFraud, redactPII } from '../lib/detector';
import { Send, User, MessageCircle } from 'lucide-react';
import { cn } from '../lib/utils';

type Message = {
  id: string;
  type: 'user' | 'bot';
  content: string;
};

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', type: 'bot', content: 'Hello. I can help you check a message for warning signs. Just paste it below.' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!input.trim()) return;
    
    const userMsg = input;
    const redacted = redactPII(userMsg);
    
    setMessages(prev => [...prev, { id: Date.now().toString(), type: 'user', content: redacted }]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const res = detectFraud(userMsg);
      let botResponse = \`Based on what you sent, the status is: **\${res.riskLevel}**.\\n\\n\`;
      
      if (res.findings.length > 0) {
        botResponse += \`**What we found:**\\n\${res.findings.map(r => '- ' + r).join('\\n')}\\n\\n\`;
      }
      
      if (res.actions.length > 0) {
        botResponse += \`**What you should do:**\\n\${res.actions.map(r => '- ' + r).join('\\n')}\`;
      }
      
      setMessages(prev => [...prev, { id: Date.now().toString(), type: 'bot', content: botResponse }]);
      setIsTyping(false);
    }, 1000);
  };

  return (
    <div className="flex flex-col h-[75vh]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-stone-900">Ask for help</h1>
        <p className="text-stone-600">A conversational way to verify suspicious texts.</p>
      </div>

      <GlassCard className="flex-1 flex flex-col overflow-hidden border-stone-200">
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-50">
          {messages.map(msg => (
            <div key={msg.id} className={cn("flex gap-3 max-w-[90%] md:max-w-[80%]", msg.type === 'user' ? "ml-auto flex-row-reverse" : "")}>
              <div className={cn("w-8 h-8 rounded flex items-center justify-center shrink-0 text-white mt-1", msg.type === 'user' ? "bg-blue-700" : "bg-stone-800")}>
                {msg.type === 'user' ? <User className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
              </div>
              <div className={cn("p-3 md:p-4 rounded-lg text-sm md:text-base whitespace-pre-wrap shadow-sm leading-relaxed", 
                msg.type === 'user' ? "bg-blue-700 text-white rounded-tr-sm" : "bg-white border border-stone-200 text-stone-800 rounded-tl-sm"
              )}>
                {msg.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-3 max-w-[85%]">
              <div className="w-8 h-8 rounded bg-stone-800 text-white flex items-center justify-center shrink-0 mt-1">
                <MessageCircle className="w-4 h-4" />
              </div>
              <div className="p-4 rounded-lg bg-white border border-stone-200 rounded-tl-sm flex items-center gap-1.5 shadow-sm">
                <span className="w-2 h-2 bg-stone-400 rounded-full animate-pulse"></span>
                <span className="w-2 h-2 bg-stone-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></span>
                <span className="w-2 h-2 bg-stone-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
        
        <div className="p-3 bg-white border-t border-stone-200">
          <div className="flex gap-2">
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Paste suspicious text here..."
              className="flex-1 bg-stone-50 border border-stone-300 rounded px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:bg-white text-base text-stone-900"
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="bg-blue-700 text-white w-12 rounded flex items-center justify-center hover:bg-blue-800 disabled:opacity-50 transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-1"
              aria-label="Send message"
            >
              <Send className="w-5 h-5 ml-0.5" />
            </button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
`,
    "src/App.tsx": `import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Report } from './pages/Report';
import { Alerts } from './pages/Alerts';
import { About } from './pages/About';
import { Chat } from './pages/Chat';
import { Analyst } from './pages/Analyst';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="report" element={<Report />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="about" element={<About />} />
          <Route path="chat" element={<Chat />} />
          <Route path="analyst" element={<Analyst />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
`
};

for (const [filepath, content] of Object.entries(files)) {
    const fullPath = path.join(baseDir, filepath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
}
console.log("Scaffolded JS script completed.");
