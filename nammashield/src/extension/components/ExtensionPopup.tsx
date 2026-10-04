import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Check, ChevronDown } from "lucide-react";
import type { DetectionResult, RiskLevel } from "../../lib/detector";
import { analyzeExtensionPage, MockAnalysisError, UnsupportedPageError } from "../services/mockExtensionAnalysis";
import { type CachedPageCheck, type DemoPage, type ExtensionAnalysisResult, DEMO_PAGES, REPORT_CATEGORIES } from "../types/extension";
import { AnalysisProgress, AssessmentSummary, CurrentPageCard, ExtensionFooter, ExtensionHeader, PrivacyNotice } from "./PopupParts";

type PopupView = "default" | "already-checked" | "loading" | "result" | "report" | "report-submitted" | "error" | "unsupported";

const cacheKey = "thoondilguard-extension-checks";

function readChecks(): CachedPageCheck[] {
  try { return JSON.parse(sessionStorage.getItem(cacheKey) ?? "[]") as CachedPageCheck[]; } catch { return []; }
}
function getCachedCheck(url: string) { return readChecks().find((c) => c.url === url); }

export function ExtensionPopup() {
  const navigate = useNavigate();
  const [view, setView] = useState<PopupView>("default");
  const [page, setPage] = useState<DemoPage>(DEMO_PAGES[0]);
  const [result, setResult] = useState<ExtensionAnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [category, setCategory] = useState(REPORT_CATEGORIES[0]);
  const [reportId, setReportId] = useState("");

  useEffect(() => {
    const cached = getCachedCheck(page.url);
    if (cached) {
      setResult(cached.result);
      setView("already-checked");
    } else {
      setView("default");
    }
  }, [page.url]);

  const selectDemoPage = (url: string) => {
    const next = DEMO_PAGES.find((p) => p.url === url);
    if (next) setPage(next);
  };

  const checkThisPage = async () => {
    setView("loading");
    setErrorMessage("");

    try {
      // Simulate fake steps since the mock API just resolves
      await new Promise(r => setTimeout(r, 500));
      const res = await analyzeExtensionPage(page.url);
      setResult(res);
      const checks = readChecks().filter((c) => c.url !== page.url);
      checks.push({ url: page.url, checkedAt: new Date().toISOString(), result: res });
      sessionStorage.setItem(cacheKey, JSON.stringify(checks));
      setView("result");
    } catch (error) {
      if (error instanceof UnsupportedPageError) setView("unsupported");
      else {
        setErrorMessage(error instanceof MockAnalysisError ? error.message : "An unexpected error occurred.");
        setView("error");
      }
    }
  };

  const handleViewDetails = () => {
    if (!result) return;
    
    let riskLevel: RiskLevel = 'No strong warning signs found';
    if (result.assessment === "high-concern") riskLevel = 'High concern';
    else if (result.assessment === "needs-verification") riskLevel = 'Needs verification';

    const detectionResult: DetectionResult = {
      riskLevel: riskLevel,
      findings: result.indicators,
      actions: [result.summary]
    };
    
    const checks = JSON.parse(sessionStorage.getItem('thg-demo-checks') || '[]');
    sessionStorage.setItem('thg-demo-checks', JSON.stringify([{
      id: 'ext-' + Date.now().toString(),
      text: page.url,
      timestamp: Date.now(),
      result: detectionResult
    }, ...checks]));
    
    navigate("/check/result", { state: { result: detectionResult, text: page.url } });
  };

  const submitReport = () => {
    const id = `TG-EXT-${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`;
    setReportId(id);
    setView("report-submitted");
  };

  return (
    <main className="w-full bg-[#F9F8F6] font-sans text-stone-900 antialiased relative">
      <div className="flex flex-col gap-4 p-5">
        <ExtensionHeader />

        {view === "default" && (
          <>
            <CurrentPageCard page={page} />
            <PrivacyNotice />
            <button type="button" onClick={() => void checkThisPage()} className="w-full rounded-xl bg-teal-700 px-4 py-3.5 text-[13px] font-semibold text-white hover:bg-teal-800 transition-colors shadow-sm">
              CHECK THIS PAGE
            </button>
            <DemoPagePicker page={page} onSelect={selectDemoPage} />
          </>
        )}

        {view === "already-checked" && result && (
          <>
            <CurrentPageCard page={page} />
            <AssessmentSummary result={result} />
            <div className="grid grid-cols-2 gap-3 mt-1">
              <button type="button" onClick={() => void checkThisPage()} className="rounded-xl border border-stone-200 bg-white px-3 py-3 text-[13px] font-semibold text-stone-700 hover:bg-stone-50 transition-colors shadow-sm">
                CHECK AGAIN
              </button>
              <button type="button" onClick={handleViewDetails} className="rounded-xl bg-teal-700 px-3 py-3 text-[13px] font-semibold text-white hover:bg-teal-800 transition-colors shadow-sm">
                VIEW DETAILS
              </button>
            </div>
            <DemoPagePicker page={page} onSelect={selectDemoPage} />
          </>
        )}

        {view === "loading" && <AnalysisProgress step={1} />}

        {view === "result" && result && (
          <>
            <AssessmentSummary result={result} />
            <div className="grid grid-cols-2 gap-3 mt-1">
              <button type="button" onClick={() => setView("report")} className="rounded-xl border border-stone-200 bg-white px-3 py-3 text-[13px] font-semibold text-stone-700 hover:bg-stone-50 transition-colors shadow-sm">
                REPORT PAGE
              </button>
              <button type="button" onClick={handleViewDetails} className="rounded-xl bg-teal-700 px-3 py-3 text-[13px] font-semibold text-white hover:bg-teal-800 transition-colors shadow-sm">
                VIEW DETAILS
              </button>
            </div>
            <DemoPagePicker page={page} onSelect={selectDemoPage} />
          </>
        )}

        {view === "report" && (
          <ReportPanel
            category={category}
            onCategoryChange={setCategory}
            onBack={() => setView(result ? "result" : "default")}
            onSubmit={submitReport}
          />
        )}

        {view === "report-submitted" && (
          <section role="status" className="flex flex-col items-center justify-center text-center space-y-4 rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Check aria-hidden="true" className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-stone-800">Report Submitted</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-stone-500">Your tracking ID is:</p>
            </div>
            <p className="w-full rounded-xl border border-stone-100 bg-stone-50 py-3 text-center font-mono text-sm font-bold text-stone-700 tracking-wider">
              {reportId}
            </p>
            <button type="button" onClick={() => navigate("/track")} className="w-full rounded-xl bg-teal-700 px-4 py-3 text-[13px] font-semibold text-white hover:bg-teal-800 transition-colors shadow-sm mt-2">
              TRACK REPORT
            </button>
          </section>
        )}

        {view === "error" && (
          <section role="alert" className="space-y-4 rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <AlertTriangle aria-hidden="true" className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-stone-800">Check Failed</h2>
                <p className="mt-0.5 text-[13px] text-stone-500">{errorMessage}</p>
              </div>
            </div>
            <button type="button" onClick={() => void checkThisPage()} className="w-full rounded-xl bg-teal-700 px-4 py-3 text-[13px] font-semibold text-white hover:bg-teal-800 transition-colors shadow-sm">
              TRY AGAIN
            </button>
          </section>
        )}

        {view === "unsupported" && (
          <section className="space-y-4 rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                <AlertTriangle aria-hidden="true" className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-stone-800">Unsupported Page</h2>
                <p className="mt-0.5 text-[13px] leading-relaxed text-stone-500">Browser settings and local pages cannot be scanned.</p>
              </div>
            </div>
          </section>
        )}

        <ExtensionFooter />
      </div>
    </main>
  );
}

function DemoPagePicker({ page, onSelect }: { page: DemoPage; onSelect: (url: string) => void }) {
  return (
    <div className="relative mt-2">
      <select 
        value={page.url} 
        onChange={(e) => onSelect(e.target.value)} 
        className="w-full appearance-none rounded-xl border border-stone-200 bg-white px-4 py-3 pr-10 text-[13px] font-medium text-stone-600 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 shadow-sm transition-all"
      >
        {DEMO_PAGES.map((item) => <option key={item.url} value={item.url}>{item.label}</option>)}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-stone-400">
        <ChevronDown className="h-4 w-4" />
      </div>
    </div>
  );
}

function ReportPanel({ category, onCategoryChange, onBack, onSubmit }: any) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="rounded-full p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="text-sm font-semibold text-stone-800">Report Page</h2>
      </div>
      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-stone-400">Category</label>
        <div className="relative">
          <select 
            value={category} 
            onChange={(e) => onCategoryChange(e.target.value)} 
            className="w-full appearance-none rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 pr-10 text-[13px] font-medium text-stone-700 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
          >
            {REPORT_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-stone-400">
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>
      </div>
      <button type="button" onClick={onSubmit} className="mt-2 w-full rounded-xl bg-teal-700 px-4 py-3.5 text-[13px] font-semibold text-white hover:bg-teal-800 transition-colors shadow-sm">
        SUBMIT REPORT
      </button>
    </section>
  );
}
