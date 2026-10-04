import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ExternalLink, ShieldCheck, X } from "lucide-react";
import type { DemoPage, ExtensionAnalysisResult, ExtensionAssessment } from "../types/extension";

const assessmentLabels: Record<ExtensionAssessment, string> = {
  "high-concern": "High Risk Detected",
  "needs-verification": "Needs Verification",
  "no-strong-warning": "No Risks Detected",
};

const assessmentStyles: Record<ExtensionAssessment, string> = {
  "high-concern": "bg-red-50 text-red-700",
  "needs-verification": "bg-amber-50 text-amber-700",
  "no-strong-warning": "bg-emerald-50 text-emerald-700",
};

export function ExtensionHeader() {
  return (
    <header className="flex items-center justify-between pb-2 pt-1">
      <div className="flex items-center gap-2.5 font-semibold tracking-tight text-stone-900">
        <div className="w-7 h-7 rounded-full bg-teal-50 flex items-center justify-center">
          <ShieldCheck aria-hidden="true" className="h-4 w-4 text-teal-600" />
        </div>
        <span className="text-[15px]">ThoondilGuard</span>
      </div>
      <Link
        to="/"
        aria-label="Close extension preview"
        className="rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </Link>
    </header>
  );
}

export function PrivacyNotice({ compact = false }: { compact?: boolean }) {
  if (compact) return null;
  return (
    <div className="flex gap-3 rounded-xl bg-stone-100/50 p-4 text-[13px] leading-relaxed text-stone-500">
      <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0 text-stone-400 mt-0.5" />
      <p>
        <strong className="text-stone-700 font-semibold">Privacy First.</strong>{" "}
        This extension doesn't track browsing. It only scans pages when you click check.
      </p>
    </div>
  );
}

export function CurrentPageCard({ page }: { page: DemoPage }) {
  let hostname = page.url;
  try {
    hostname = new URL(page.url).hostname || page.url;
  } catch {}
  return (
    <section className="bg-white rounded-2xl p-4 shadow-sm border border-stone-100">
      <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1.5">
        Current Tab
      </p>
      <h2 className="truncate text-sm font-semibold text-stone-800" title={page.title}>
        {page.title}
      </h2>
      <p className="mt-0.5 text-[13px] font-medium text-stone-500 truncate">{hostname}</p>
    </section>
  );
}

export function AssessmentBadge({ assessment }: { assessment: ExtensionAssessment }) {
  const Icon = assessment === "no-strong-warning" ? CheckCircle2 : AlertTriangle;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${assessmentStyles[assessment]}`}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {assessmentLabels[assessment]}
    </span>
  );
}

export function AnalysisProgress({ step }: { step: number }) {
  const steps = ["Analyzing domain reputation", "Scanning for malicious patterns", "Generating threat report"];
  return (
    <section className="bg-white rounded-2xl p-5 shadow-sm border border-stone-100">
      <h2 className="text-sm font-semibold text-stone-800 mb-4">Scanning securely...</h2>
      <ol className="space-y-4">
        {steps.map((label, index) => (
          <li key={label} className="flex items-center gap-3 text-[13px]">
            <span className="flex h-5 w-5 items-center justify-center">
              {index < step ? (
                <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-teal-600" />
              ) : index === step ? (
                <span className="h-2 w-2 animate-pulse rounded-full bg-teal-500" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-stone-200" />
              )}
            </span>
            <span className={index <= step ? "text-stone-700 font-medium" : "text-stone-400"}>{label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ExtensionFooter() {
  return (
    <footer className="pt-2 pb-1 text-center text-[11px] font-medium text-stone-400 space-y-1">
      <p>Manual check only • No tracking</p>
      <p>Interactive Prototype</p>
    </footer>
  );
}

export function AssessmentSummary({ result }: { result: ExtensionAnalysisResult }) {
  const isHighRisk = result.assessment === "high-concern";
  const isMediumRisk = result.assessment === "needs-verification";
  const bgClass = isHighRisk ? "bg-red-50/50" : isMediumRisk ? "bg-amber-50/50" : "bg-emerald-50/50";
  const barClass = isHighRisk ? "bg-red-500" : isMediumRisk ? "bg-amber-500" : "bg-emerald-500";
  
  return (
    <section className={`rounded-2xl p-4 shadow-sm border border-stone-100 bg-white`}>
      <div className="flex items-center justify-between mb-4">
        <AssessmentBadge assessment={result.assessment} />
        <span className="text-xs font-bold text-stone-400">Score: <span className="text-stone-700">{result.score}/100</span></span>
      </div>
      
      <div className="h-1.5 w-full rounded-full bg-stone-100 overflow-hidden mb-4">
        <div className={`h-full rounded-full transition-all duration-1000 ${barClass}`} style={{ width: `${result.score}%` }} />
      </div>

      <div className={`p-3 rounded-xl ${bgClass} border ${isHighRisk ? 'border-red-100' : isMediumRisk ? 'border-amber-100' : 'border-emerald-100'}`}>
        <p className="text-[13px] leading-relaxed text-stone-700">{result.summary}</p>
      </div>
    </section>
  );
}

export function OpenWebsiteLink() {
  return (
    <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors">
      Open Dashboard <ExternalLink aria-hidden="true" className="h-3 w-3" />
    </Link>
  );
}
