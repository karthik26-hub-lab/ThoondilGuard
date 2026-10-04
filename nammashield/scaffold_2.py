import os

base_dir = r"C:\Users\KARTHIK\Desktop\rec\nammashield"

files = {
    "src/pages/Check.tsx": """import { useState } from 'react';
import { GlassCard } from '../components/GlassCard';
import { detectFraud, redactPII, DetectionResult } from '../lib/detector';
import { AlertTriangle, CheckCircle, ShieldAlert, ArrowRight, Loader2, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Check() {
  const [input, setInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [redactedText, setRedactedText] = useState('');
  const navigate = useNavigate();

  const handleCheck = () => {
    if (!input.trim()) return;
    setIsAnalyzing(true);
    setResult(null);
    
    // Simulate network delay for realistic feel
    setTimeout(() => {
      const res = detectFraud(input);
      setResult(res);
      setRedactedText(redactPII(input));
      setIsAnalyzing(false);
    }, 1200);
  };

  const loadExample = (type: 'phishing' | 'job' | 'safe') => {
    if (type === 'phishing') setInput("Dear customer, your bank account is suspended. Update KYC immediately via http://sbi-update-kyc.xyz or act fast to avoid charges.");
    if (type === 'job') setInput("Earn 5000 rs daily! Work from home part-time. Contact HR on WhatsApp: 9876543210. Link: bit.ly/job-offer");
    if (type === 'safe') setInput("Hi Ramesh, let's meet at the coffee shop at 5 PM tomorrow.");
  };

  const getRiskColor = (level: string) => {
    if (level === 'High') return 'text-red-600 bg-red-50 border-red-200';
    if (level === 'Caution') return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  const getRiskIcon = (level: string) => {
    if (level === 'High') return <ShieldAlert className="w-10 h-10 text-red-600" />;
    if (level === 'Caution') return <AlertTriangle className="w-10 h-10 text-amber-600" />;
    return <CheckCircle className="w-10 h-10 text-green-600" />;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-3">Check a message or link</h1>
        <p className="text-slate-600">Paste the exact text or link you received. We'll look for warning signs.</p>
      </div>

      <GlassCard className="p-6">
        <label htmlFor="message-input" className="block text-sm font-medium text-slate-700 mb-2">
          Message or Link to verify
        </label>
        <textarea
          id="message-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g., You have won a prize! Click here..."
          className="w-full h-32 p-4 rounded-xl border border-slate-200 bg-white/50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none shadow-inner"
        />
        
        <div className="mt-3 flex flex-wrap gap-2 text-sm mb-6">
          <span className="text-slate-500">Try examples:</span>
          <button onClick={() => loadExample('phishing')} className="text-blue-600 hover:underline">Phishing</button>
          <button onClick={() => loadExample('job')} className="text-blue-600 hover:underline">Job Scam</button>
          <button onClick={() => loadExample('safe')} className="text-blue-600 hover:underline">Safe Message</button>
        </div>

        <button
          onClick={handleCheck}
          disabled={!input.trim() || isAnalyzing}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-3.5 rounded-xl font-semibold shadow-md transition-all flex justify-center items-center gap-2"
        >
          {isAnalyzing ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Analyzing...</>
          ) : (
            'Analyze Message'
          )}
        </button>
      </GlassCard>

      {result && (
        <GlassCard delay={0.1} className={`p-6 border-2 ${result.riskLevel === 'High' ? 'border-red-100' : result.riskLevel === 'Caution' ? 'border-amber-100' : 'border-green-100'}`}>
          <div className="flex items-start gap-4 mb-6">
            <div className={`p-3 rounded-2xl ${getRiskColor(result.riskLevel)}`}>
              {getRiskIcon(result.riskLevel)}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                {result.riskLevel} Risk
              </h2>
              <p className="text-slate-600 mt-1">
                {result.riskLevel === 'High' && "This looks very suspicious. Do not click links or share details."}
                {result.riskLevel === 'Caution' && "Exercise caution. Verify the sender through official channels."}
                {result.riskLevel === 'Low' && "We didn't find obvious signs of a scam, but remain vigilant."}
              </p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-100">
            <h3 className="font-semibold text-sm text-slate-700 mb-3 flex items-center gap-2">
              <Info className="w-4 h-4" /> Why this may be risky:
            </h3>
            <ul className="space-y-2">
              {result.reasons.map((reason, idx) => (
                <li key={idx} className="flex gap-2 text-sm text-slate-600">
                  <span className="text-blue-500 mt-0.5">•</span> {reason}
                </li>
              ))}
            </ul>
          </div>

          {result.riskLevel !== 'Low' && (
            <div className="border-t border-slate-100 pt-6">
              <h3 className="font-semibold mb-2">Next Steps</h3>
              <p className="text-sm text-slate-600 mb-4">
                Help protect your community in Tamil Nadu by reporting this. We will automatically remove phone numbers and emails.
              </p>
              <button 
                onClick={() => navigate('/report', { state: { text: redactedText, risk: result.riskLevel } })}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-medium flex justify-center items-center gap-2 transition-colors"
              >
                Report this scam <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
          
          <div className="mt-4 text-center">
            <p className="text-xs text-slate-400">
              Note: This is a prototype assessment, not a guarantee of safety.
            </p>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
""",
    "src/pages/Report.tsx": """import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GlassCard } from '../components/GlassCard';
import { saveReport } from '../lib/storage';
import { CheckCircle2 } from 'lucide-react';

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
    if (!text && !location.state?.text) {
      // Direct visit is fine
    }
  }, [text, location.state]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text || !region || !category) return;

    saveReport({
      originalText: text,
      region,
      category,
      riskLevel: location.state?.risk || 'High',
    });
    
    setSubmitted(true);
    setTimeout(() => {
      navigate('/alerts');
    }, 2500);
  };

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto text-center py-20">
        <GlassCard className="p-10 flex flex-col items-center">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Report Submitted Anonymously</h2>
          <p className="text-slate-600 mb-6">Thank you. Your report will help warn others in your region.</p>
          <p className="text-sm text-slate-400">Redirecting to alerts...</p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-3">Report a Scam</h1>
        <p className="text-slate-600">Submit suspicious messages to help protect the community. We never ask for personal details.</p>
      </div>

      <GlassCard className="p-6 md:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Suspicious Message or Link</label>
            <p className="text-xs text-slate-500 mb-2">Personal info like phone numbers and emails are automatically redacted.</p>
            <textarea
              required
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full h-24 p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
              placeholder="Paste the suspicious content here..."
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Your Region (Tamil Nadu)</label>
              <select 
                required
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="" disabled>Select Region</option>
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Scam Category</label>
              <select 
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="" disabled>Select Category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3 text-sm text-blue-800">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-blue-600 mt-0.5" />
            <p>
              <strong>Privacy guarantee:</strong> This report is anonymous. Please do not include your OTPs, passwords, or bank account numbers in the text above.
            </p>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-semibold shadow-md transition-all"
          >
            Submit Report Anonymously
          </button>
        </form>
      </GlassCard>
    </div>
  );
}
""",
    "src/pages/Alerts.tsx": """import { useState } from 'react';
import { GlassCard } from '../components/GlassCard';
import { getReports } from '../lib/storage';
import { MapPin, Tag, Clock, AlertTriangle } from 'lucide-react';

export function Alerts() {
  const allReports = getReports();
  const [filterRegion, setFilterRegion] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');
  
  const regions = ['All', ...Array.from(new Set(allReports.map(r => r.region)))];
  const categories = ['All', ...Array.from(new Set(allReports.map(r => r.category)))];
  
  const filtered = allReports.filter(r => {
    const rMatch = filterRegion === 'All' || r.region === filterRegion;
    const cMatch = filterCategory === 'All' || r.category === filterCategory;
    return rMatch && cMatch;
  });

  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr);
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
      Math.round((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      'day'
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-3">Community Alerts</h1>
          <p className="text-slate-600">Recent scams reported by residents across Tamil Nadu.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="w-full sm:w-48">
            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Region</label>
            <select 
              value={filterRegion}
              onChange={(e) => setFilterRegion(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 bg-white/70 backdrop-blur-sm focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            >
              {regions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="w-full sm:w-48">
            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Category</label>
            <select 
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 bg-white/70 backdrop-blur-sm focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <GlassCard className="p-10 text-center text-slate-500">
            No reports found matching your criteria.
          </GlassCard>
        ) : (
          filtered.map((report, i) => (
            <GlassCard key={report.id} delay={i * 0.05} className="p-5 md:p-6 transition-transform hover:-translate-y-1 hover:shadow-lg">
              <div className="flex flex-col md:flex-row gap-4 items-start">
                <div className="flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                      <MapPin className="w-3 h-3" /> {report.region}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                      <Tag className="w-3 h-3" /> {report.category}
                    </span>
                    {report.isSeed && (
                      <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 ml-auto border border-slate-200 px-1.5 py-0.5 rounded">Sample Data</span>
                    )}
                  </div>
                  
                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 text-sm text-slate-800 font-medium font-mono">
                    "{report.originalText}"
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Reported {formatDate(report.timestamp)}</span>
                      {report.riskLevel === 'High' && (
                        <span className="flex items-center gap-1 text-red-600 font-medium"><AlertTriangle className="w-3.5 h-3.5" /> High Risk</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>
          ))
        )}
      </div>
    </div>
  );
}
""",
    "src/pages/Chat.tsx": """import { useState, useRef, useEffect } from 'react';
import { GlassCard } from '../components/GlassCard';
import { detectFraud, redactPII } from '../lib/detector';
import { Send, Bot, User, MessageSquare } from 'lucide-react';
import { cn } from '../lib/utils';

type Message = {
  id: string;
  type: 'user' | 'bot';
  content: string;
  isRedacted?: boolean;
};

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', type: 'bot', content: 'Hi! I am NammaShield Bot. Paste any suspicious message or link here, and I will check it for you.' }
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
    
    setMessages(prev => [...prev, { id: Date.now().toString(), type: 'user', content: redacted, isRedacted: userMsg !== redacted }]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const res = detectFraud(userMsg);
      let botResponse = `I analyzed this message. **Risk Level: ${res.riskLevel}**.\n\n`;
      
      if (res.reasons.length > 0) {
        botResponse += `Reasons:\n${res.reasons.map(r => '- ' + r).join('\n')}\n\n`;
      }
      
      if (res.riskLevel !== 'Low') {
        botResponse += "Recommendation: Do not click the link or provide any personal details. Please report this to help others.";
      } else {
        botResponse += "It looks mostly safe, but always be careful with unexpected messages.";
      }
      
      setMessages(prev => [...prev, { id: Date.now().toString(), type: 'bot', content: botResponse }]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[80vh]">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold mb-2">Web Verification Chat</h1>
        <p className="text-slate-600 flex items-center justify-center gap-2">
          <MessageSquare className="w-4 h-4" /> WhatsApp integration coming soon
        </p>
      </div>

      <GlassCard className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
          {messages.map(msg => (
            <div key={msg.id} className={cn("flex gap-3 max-w-[85%]", msg.type === 'user' ? "ml-auto flex-row-reverse" : "")}>
              <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", msg.type === 'user' ? "bg-blue-600 text-white" : "bg-emerald-500 text-white")}>
                {msg.type === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={cn("p-3 rounded-2xl text-sm whitespace-pre-wrap shadow-sm", 
                msg.type === 'user' ? "bg-blue-600 text-white rounded-tr-sm" : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm"
              )}>
                {msg.content}
                {msg.isRedacted && (
                  <div className="text-[10px] opacity-70 mt-1 italic">Note: Personal details were redacted for privacy.</div>
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-3 max-w-[85%]">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-4 rounded-2xl bg-white border border-slate-200 rounded-tl-sm flex items-center gap-1.5 shadow-sm">
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
        
        <div className="p-4 bg-white border-t border-slate-100">
          <div className="flex gap-2">
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Paste suspicious text here..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm"
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="bg-blue-600 text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
""",
    "src/pages/Analyst.tsx": """import { GlassCard } from '../components/GlassCard';
import { getReports } from '../lib/storage';
import { BarChart3, AlertTriangle, ShieldCheck, PieChart } from 'lucide-react';

export function Analyst() {
  const reports = getReports();
  
  // Basic analytics
  const total = reports.length;
  const highRisk = reports.filter(r => r.riskLevel === 'High').length;
  
  // Group by category
  const categories = reports.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Group by region
  const regions = reports.reduce((acc, curr) => {
    acc[curr.region] = (acc[curr.region] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-indigo-600" />
          Threat Analyst View
        </h1>
        <p className="text-slate-600 inline-flex items-center gap-2">
          <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Prototype</span>
          Pattern analysis and campaign grouping dashboard.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <GlassCard className="p-6 border-l-4 border-l-blue-500">
          <div className="text-slate-500 text-sm font-semibold mb-1">Total Reports</div>
          <div className="text-3xl font-bold">{total}</div>
        </GlassCard>
        <GlassCard className="p-6 border-l-4 border-l-red-500">
          <div className="text-slate-500 text-sm font-semibold mb-1">High Risk Threats</div>
          <div className="text-3xl font-bold text-red-600">{highRisk}</div>
        </GlassCard>
        <GlassCard className="p-6 border-l-4 border-l-emerald-500">
          <div className="text-slate-500 text-sm font-semibold mb-1">Regions Monitored</div>
          <div className="text-3xl font-bold text-emerald-600">{Object.keys(regions).length}</div>
        </GlassCard>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <GlassCard className="p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-slate-400" />
            Top Categories
          </h2>
          <div className="space-y-4">
            {Object.entries(categories).sort((a,b)=>b[1]-a[1]).map(([cat, count]) => (
              <div key={cat}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-slate-700">{cat}</span>
                  <span className="text-slate-500">{count} reports</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${(count/total)*100}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-slate-400" />
            Regional Hotspots
          </h2>
          <div className="space-y-4">
            {Object.entries(regions).sort((a,b)=>b[1]-a[1]).map(([reg, count]) => (
              <div key={reg}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-slate-700">{reg}</span>
                  <span className="text-slate-500">{count} reports</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${(count/total)*100}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-6">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-slate-400" />
          Identified Campaigns (Clustered)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3 rounded-tl-lg">Campaign Type</th>
                <th className="p-3">Indicators (Domains / Tactics)</th>
                <th className="p-3">Volume</th>
                <th className="p-3 rounded-tr-lg">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50/50">
                <td className="p-3 font-medium text-slate-800">EB Bill Disconnection</td>
                <td className="p-3 text-slate-600 font-mono text-xs">update-eb-bill.com, 'suspended'</td>
                <td className="p-3 text-slate-600">High</td>
                <td className="p-3"><span className="text-red-600 bg-red-50 px-2 py-1 rounded text-xs font-semibold">Active Tracker</span></td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="p-3 font-medium text-slate-800">Part-time Job YouTube</td>
                <td className="p-3 text-slate-600 font-mono text-xs">bit.ly/job-offer, '5000/day'</td>
                <td className="p-3 text-slate-600">Medium</td>
                <td className="p-3"><span className="text-amber-600 bg-amber-50 px-2 py-1 rounded text-xs font-semibold">Monitoring</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
""",
    "src/App.tsx": """import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Check } from './pages/Check';
import { Report } from './pages/Report';
import { Alerts } from './pages/Alerts';
import { Chat } from './pages/Chat';
import { Analyst } from './pages/Analyst';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="check" element={<Check />} />
          <Route path="report" element={<Report />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="chat" element={<Chat />} />
          <Route path="analyst" element={<Analyst />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
""",
    "src/main.tsx": """import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
"""
}

for filepath, content in files.items():
    full_path = os.path.join(base_dir, filepath)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content)

print("Scaffolded phase 2 successfully.")
