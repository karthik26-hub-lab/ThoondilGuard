import os

base_dir = r"C:\Users\KARTHIK\Desktop\rec\nammashield"

files = {
    "postcss.config.js": """export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
""",
    "tailwind.config.js": """/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        glass: {
          light: 'rgba(255, 255, 255, 0.7)',
          border: 'rgba(255, 255, 255, 0.4)',
        }
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
      }
    },
  },
  plugins: [],
}
""",
    "src/index.css": """@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-slate-50 text-slate-800 antialiased selection:bg-blue-200;
    /* Soft mesh gradient background */
    background-image: 
      radial-gradient(at 40% 20%, hsla(210,100%,93%,1) 0px, transparent 50%),
      radial-gradient(at 80% 0%, hsla(189,100%,96%,1) 0px, transparent 50%),
      radial-gradient(at 0% 50%, hsla(210,100%,96%,1) 0px, transparent 50%);
    background-attachment: fixed;
    min-height: 100vh;
  }
}
""",
    "src/lib/utils.ts": """import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
""",
    "src/lib/detector.ts": """export type RiskLevel = 'Low' | 'Caution' | 'High';

export interface DetectionResult {
  riskLevel: RiskLevel;
  reasons: string[];
  safeScore: number;
}

const URGENCIES = ['urgent', 'immediate', 'act fast', 'suspended', 'blocked', 'warning', 'expires', 'limit exceeded', 'action required', 'udane', 'udanae', 'vuraivil'];
const CREDENTIALS_PAYMENTS = ['otp', 'cvv', 'password', 'pin', 'bank account', 'click here to pay', 'payment', 'credit card', 'debit card', 'panam', 'vangi kanaku', 'kadan', 'eb bill', 'kyc'];
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
  const reasons: string[] = [];
  let score = 0;

  // 1. Check for URLs
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
      reasons.push("Contains a suspicious link or common URL shortener often used to hide real destinations.");
      score += 40;
    } else {
      reasons.push("Contains a link. Always verify the sender before clicking, even if it looks normal.");
      score += 15;
    }
  }

  // 2. Check Urgency
  const hasUrgency = URGENCIES.some(u => lowerText.includes(u));
  if (hasUrgency) {
    reasons.push("Creates a false sense of urgency (e.g., account suspended, act immediately).");
    score += 30;
  }

  // 3. Check Credentials / Payments
  const hasCreds = CREDENTIALS_PAYMENTS.some(c => lowerText.includes(c));
  if (hasCreds) {
    reasons.push("Requests sensitive information or payments (e.g., OTP, bank details, KYC update).");
    score += 40;
  }

  // Determine Risk Level
  let riskLevel: RiskLevel = 'Low';
  if (score >= 60) riskLevel = 'High';
  else if (score >= 30) riskLevel = 'Caution';

  if (reasons.length === 0) {
    reasons.push("No immediate red flags detected, but always stay vigilant with unexpected messages.");
  }

  return { riskLevel, reasons, safeScore: Math.max(0, 100 - score) };
}
""",
    "src/lib/storage.ts": """export interface Report {
  id: string;
  originalText: string;
  region: string;
  category: string;
  context?: string;
  timestamp: string;
  riskLevel: 'Low' | 'Caution' | 'High';
  isSeed?: boolean;
}

const SEED_DATA: Report[] = [
  {
    id: 'seed-1',
    originalText: 'Dear customer, your EB Bill is pending. Update your KYC via http://update-eb-bill.com to avoid disconnection [PHONE REDACTED]',
    region: 'Chennai',
    category: 'Electricity Bill',
    timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    riskLevel: 'High',
    isSeed: true
  },
  {
    id: 'seed-2',
    originalText: 'Congratulations! You won ₹10,000 in lucky draw. Click bit.ly/win-prize to claim.',
    region: 'Coimbatore',
    category: 'Lottery/Prize',
    timestamp: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
    riskLevel: 'High',
    isSeed: true
  },
  {
    id: 'seed-3',
    originalText: 'Work from home and earn ₹5000/day. Just like YouTube videos. WhatsApp [PHONE REDACTED]',
    region: 'Madurai',
    category: 'Part-time Job',
    timestamp: new Date(Date.now() - 43200000).toISOString(), // 12 hours ago
    riskLevel: 'Caution',
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
  const newReport: Report = {
    ...report,
    id: `rep-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    timestamp: new Date().toISOString(),
    isSeed: false
  };
  reports.unshift(newReport);
  localStorage.setItem('nammashield_reports', JSON.stringify(reports));
}
""",
    "src/components/GlassCard.tsx": """import { ReactNode } from 'react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';

export function GlassCard({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      className={cn(
        "bg-white/70 backdrop-blur-xl border border-white/60 shadow-glass rounded-2xl overflow-hidden",
        className
      )}
    >
      {children}
    </motion.div>
  );
}
""",
    "src/components/Layout.tsx": """import { Link, Outlet, useLocation } from 'react-router-dom';
import { ShieldCheck, Search, AlertTriangle, MessageSquare, BarChart3, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../lib/utils';

export function Layout() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { path: '/check', icon: Search, label: 'Check' },
    { path: '/report', icon: AlertTriangle, label: 'Report' },
    { path: '/alerts', icon: ShieldCheck, label: 'Alerts' },
    { path: '/chat', icon: MessageSquare, label: 'Chat' },
    { path: '/analyst', icon: BarChart3, label: 'Analyst' },
  ];

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-white/50 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
            <div className="bg-blue-600 p-1.5 rounded-lg text-white">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-800">Namma<span className="text-blue-600">Shield</span></span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2",
                    isActive ? "bg-blue-100 text-blue-700 shadow-sm" : "text-slate-600 hover:bg-slate-100"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Mobile menu toggle */}
          <button 
            className="md:hidden p-2 text-slate-600"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-slate-100 bg-white/95 backdrop-blur-xl px-4 py-4 flex flex-col gap-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "px-4 py-3 rounded-xl text-base font-medium transition-all flex items-center gap-3",
                    isActive ? "bg-blue-100 text-blue-700" : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-8">
        <Outlet />
      </main>

      <footer className="bg-white/50 border-t border-slate-200 py-8 mt-auto">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-slate-500">
          <p>NammaShield Prototype - Hackathon 2026</p>
          <p className="mt-1">For demonstration purposes only. Does not replace official police reporting.</p>
        </div>
      </footer>
    </div>
  );
}
""",
    "src/pages/Home.tsx": """import { Link } from 'react-router-dom';
import { GlassCard } from '../components/GlassCard';
import { ShieldAlert, CheckCircle, Share2, ArrowRight } from 'lucide-react';
import { getReports } from '../lib/storage';

export function Home() {
  const reports = getReports().slice(0, 3); // Get latest 3

  return (
    <div className="space-y-12">
      <section className="text-center max-w-3xl mx-auto pt-8 pb-4">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 mb-6">
          Community fraud <br className="hidden md:block"/> early-warning system
        </h1>
        <p className="text-lg md:text-xl text-slate-600 mb-8 max-w-2xl mx-auto leading-relaxed">
          Protect yourself and your community in Tamil Nadu. Check suspicious messages instantly and warn others about new scams.
        </p>
        <Link 
          to="/check" 
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full text-lg font-semibold shadow-lg shadow-blue-500/30 transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-blue-300"
        >
          Check a message or link
          <ArrowRight className="w-5 h-5" />
        </Link>
      </section>

      <section className="grid md:grid-cols-3 gap-6">
        <GlassCard delay={0.1} className="p-6 text-center">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-lg mb-2">1. Check</h3>
          <p className="text-slate-600 text-sm">Paste a suspicious SMS or link to get an instant safety assessment.</p>
        </GlassCard>
        
        <GlassCard delay={0.2} className="p-6 text-center">
          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-lg mb-2">2. Report</h3>
          <p className="text-slate-600 text-sm">If it's a scam, report it anonymously. We automatically hide personal info.</p>
        </GlassCard>

        <GlassCard delay={0.3} className="p-6 text-center">
          <div className="w-12 h-12 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Share2 className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-lg mb-2">3. Warn Others</h3>
          <p className="text-slate-600 text-sm">Your report helps alert people in your region before they get tricked.</p>
        </GlassCard>
      </section>

      <section className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-800">Recent Regional Alerts</h2>
          <Link to="/alerts" className="text-blue-600 font-medium hover:underline text-sm">View all</Link>
        </div>
        <div className="space-y-4">
          {reports.map((report, i) => (
            <GlassCard key={report.id} delay={0.4 + (i * 0.1)} className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{report.region}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100">{report.category}</span>
                </div>
                <p className="text-slate-700 text-sm line-clamp-2 mt-2">"{report.originalText}"</p>
              </div>
            </GlassCard>
          ))}
        </div>
      </section>
    </div>
  );
}
"""
}

for filepath, content in files.items():
    full_path = os.path.join(base_dir, filepath)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content)

print("Scaffolded phase 1 successfully.")
