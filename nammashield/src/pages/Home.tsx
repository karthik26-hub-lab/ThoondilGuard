import { useState } from 'react';
import { GlassCard } from '../components/GlassCard';
import { detectFraud, redactPII } from '../lib/detector';
import type { DetectionResult } from '../lib/detector';
import { AlertTriangle, Info, ArrowRight, ShieldAlert, CheckCircle2 } from 'lucide-react';
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
          <div className={`rounded-xl border ${getRiskStyles(result.riskLevel).border} ${getRiskStyles(result.riskLevel).bg} overflow-hidden`}>
            <div className="p-5 md:p-6">
              <div className="flex items-start gap-4 mb-5">
                <div className="mt-1 shrink-0">
                  {getRiskStyles(result.riskLevel).icon}
                </div>
                <div>
                  <h2 className={`text-xl md:text-2xl font-bold ${getRiskStyles(result.riskLevel).text}`}>
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
