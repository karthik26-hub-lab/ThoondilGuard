import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '../lib/i18n';
import { redactPII } from '../lib/detector';
import { ShieldCheck, Info, Smartphone, Mail, Send, ChevronRight, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const REGIONS = ['Adyar', 'Velachery', 'Thiruvanmiyur', 'Besant Nagar', 'Guindy', 'Taramani', 'Perungudi', 'Palavakkam', 'Other'];
const CATEGORIES = ['Phishing Link', 'Job/Task Scam', 'Electricity Bill Scam', 'Loan App Harassment', 'Lottery/Prize', 'Other'];

export function Report() {
  const { t, language } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [receipt] = useState<{id:string; key:string}|null>(null);
  const [error] = useState(false);
  const [text, setText] = useState(location.state?.text || '');
  const [region, setRegion] = useState('');
  const [category, setCategory] = useState('');
  const [customRegion, setCustomRegion] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [submitted] = useState(false);

  // New states for the notification section
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [keysRevealed, setKeysRevealed] = useState(false);
  const [contactMethod, setContactMethod] = useState<'sms' | 'email'>('sms');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalRegion = region === 'Other' ? customRegion.trim() : region;
    const finalCategory = category === 'Other' ? customCategory.trim() : category;
    if (!text || !finalRegion || !finalCategory) return;

    navigate('/report/verify', {state:{draft:{text:redactPII(text),region:finalRegion,category:finalCategory,risk:location.state?.risk||'User Reported'}}});
  };

  const handleSendNotification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobile && !email) return;
    setKeysRevealed(true);
  };

  const redactedPreview = text ? redactPII(text) : '';

  const smsPreviewContent = (
    <motion.div 
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="bg-white border border-stone-200 rounded-[2rem] p-5 shadow-sm relative flex flex-col h-full"
    >
      <div className="text-center mb-5 mt-2">
        <div className="w-12 h-12 bg-stone-100 rounded-full mx-auto mb-2 flex items-center justify-center text-stone-400">
          <Smartphone className="w-6 h-6" />
        </div>
        <p className="text-xs font-bold text-stone-900 tracking-wide">AD-THNDIL</p>
        <p className="text-[10px] text-stone-500 uppercase tracking-widest mt-0.5">Text Message</p>
      </div>
      <div className="bg-[#E9E9EB] text-black px-4 py-3 rounded-2xl rounded-tl-sm text-[13px] leading-relaxed w-[90%] shadow-sm border border-black/5">
        Your ThoondilGuard report <strong className="font-mono bg-stone-200 px-1 rounded text-stone-600">TG-XXXX</strong> is received. Track it securely using Key: <strong className="font-mono bg-stone-200 px-1 rounded text-stone-600">********</strong> at nammashield.in/track
      </div>
      <p className="text-[10px] text-stone-400 mt-2 ml-1">Now</p>
    </motion.div>
  );

  const emailPreviewContent = (
    <motion.div 
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="bg-white border border-stone-200 rounded-xl shadow-sm relative overflow-hidden flex flex-col h-full"
    >
      <div className="bg-stone-50/80 border-b border-stone-200 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400/80"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/80"></div>
        </div>
        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Inbox</span>
      </div>
      <div className="p-4 flex gap-3.5 bg-white">
        <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
          <span className="text-teal-700 font-bold text-sm">TG</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between mb-0.5">
            <p className="text-sm font-bold text-stone-900 truncate">ThoondilGuard</p>
            <p className="text-[10px] font-medium text-stone-400 shrink-0">Now</p>
          </div>
          <p className="text-xs text-stone-500 truncate mb-1 font-medium">To: you@example.com</p>
          <p className="text-sm font-bold text-stone-800 mb-3 leading-snug">Your Scam Report Details (TG-XXXX)</p>
          <div className="text-[13px] text-stone-700 leading-relaxed space-y-2.5">
            <p>Thank you for reporting.</p>
            <p>Your Reference ID is <strong className="font-mono bg-stone-100 px-1 rounded text-stone-500">TG-XXXX</strong> and your Private Access Key is <strong className="font-mono bg-stone-100 px-1 rounded text-stone-500">********</strong>.</p>
            <p>Do not share this key with anyone.</p>
          </div>
        </div>
      </div>
    </motion.div>
  );

  if (submitted && receipt) {
    if (keysRevealed) {
      return (
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 sm:p-8 flex flex-col items-center text-center shadow-sm max-w-3xl mx-auto">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mb-4">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-emerald-900 mb-2">{t("Here are your tracking details")}</h2>
            <p className="text-emerald-800 font-medium max-w-lg mb-6">
              {mobile || email 
                ? t("Please save your tracking details below. Delivery to your contact requires the notification service.")
                : t("Please save your tracking details below. You will need them to check the status of your report.")}
            </p>

            <div className="w-full bg-white border border-emerald-200 rounded-lg p-5 text-left space-y-4">
              <div>
                <p className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-1">{t("Report Reference")}</p>
                <code className="block select-all break-all rounded bg-stone-50 border border-stone-200 p-3 font-mono text-stone-900 font-bold text-lg">{receipt.id}</code>
              </div>
              <div>
                <p className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-1">{t("Private Access Key")}</p>
                <code className="block select-all break-all rounded bg-stone-50 border border-stone-200 p-3 font-mono text-stone-900 font-bold text-lg">{receipt.key}</code>
              </div>
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-lg font-medium flex items-start gap-2">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                {t("Save both values carefully. Losing the key means this report cannot be tracked or recovered, even by administrators.")}
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-emerald-200/50 w-full flex justify-center">
              <Link to="/track" className="inline-flex min-h-[48px] items-center justify-center px-6 gap-2 bg-emerald-700 text-white font-semibold rounded-lg hover:bg-emerald-800 transition-colors">
                {t("Proceed to Track My Report")}
                <ChevronRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="bg-white border border-stone-200 rounded-xl p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-stone-900">{t("Report Saved Successfully")}</h3>
              <p className="text-stone-600">
                {t("Enter your mobile or email to securely receive your Reference ID and Access Key.")}
              </p>
            </div>
          </div>

          <form onSubmit={handleSendNotification} className="mt-8">
            {/* MOBILE LAYOUT */}
            <div className="md:hidden space-y-6">
              <div className="flex bg-stone-100 p-1.5 rounded-lg border border-stone-200/50">
                <button 
                  type="button" 
                  onClick={() => setContactMethod('sms')}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-md transition-colors ${contactMethod === 'sms' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                >
                  SMS Notification
                </button>
                <button 
                  type="button" 
                  onClick={() => setContactMethod('email')}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-md transition-colors ${contactMethod === 'email' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                >
                  Email Notification
                </button>
              </div>

              {contactMethod === 'sms' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div>
                    <label className="block text-sm font-medium text-stone-900 mb-2" htmlFor="mobile-mobile">{t("Mobile Number")}</label>
                    <div className="relative">
                      <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                      <input
                        id="mobile-mobile"
                        type="tel"
                        value={mobile}
                        onChange={(e) => { setMobile(e.target.value); setEmail(''); }}
                        placeholder="e.g. 9876543210"
                        className="w-full min-h-[48px] pl-10 p-3 rounded-lg border border-stone-300 bg-stone-50 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-stone-900"
                      />
                    </div>
                  </div>
                  <div className="bg-[#F9F8F6] rounded-xl border border-stone-200 p-5">
                    <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-4">{t("Preview")}</h4>
                    {smsPreviewContent}
                  </div>
                </div>
              )}

              {contactMethod === 'email' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div>
                    <label className="block text-sm font-medium text-stone-900 mb-2" htmlFor="email-mobile">{t("Email Address")}</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                      <input
                        id="email-mobile"
                        type="email"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setMobile(''); }}
                        placeholder="e.g. user@example.com"
                        className="w-full min-h-[48px] pl-10 p-3 rounded-lg border border-stone-300 bg-stone-50 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-stone-900"
                      />
                    </div>
                  </div>
                  <div className="bg-[#F9F8F6] rounded-xl border border-stone-200 p-5">
                    <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-4">{t("Preview")}</h4>
                    {emailPreviewContent}
                  </div>
                </div>
              )}
            </div>

            {/* DESKTOP LAYOUT */}
            <div className="hidden md:block space-y-6">
              <div className="grid md:grid-cols-2 gap-8 mb-8">
                <div>
                  <label className="block text-sm font-medium text-stone-900 mb-2" htmlFor="mobile-desktop">{t("Mobile Number")}</label>
                  <div className="relative">
                    <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                    <input
                      id="mobile-desktop"
                      type="tel"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full min-h-[48px] pl-10 p-3 rounded-lg border border-stone-300 bg-stone-50 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-stone-900"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-900 mb-2" htmlFor="email-desktop">{t("Email Address")}</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                    <input
                      id="email-desktop"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. user@example.com"
                      className="w-full min-h-[48px] pl-10 p-3 rounded-lg border border-stone-300 bg-stone-50 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-stone-900"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-[#F9F8F6] rounded-xl border border-stone-200 p-8 space-y-5">
                <h4 className="text-sm font-bold text-stone-700 uppercase tracking-wider">{t("Preview")}</h4>
                <div className="grid lg:grid-cols-2 gap-8">
                  {smsPreviewContent}
                  {emailPreviewContent}
                </div>
              </div>
            </div>

            <div className="pt-8">
              <button
                type="submit"
                disabled={!mobile && !email}
                className="w-full min-h-[48px] flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 disabled:cursor-not-allowed text-white py-3 rounded-lg font-semibold transition-colors"
              >
                <Send className="w-4 h-4" />
                {t("Send tracking details")}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-2 text-black">{t("Report a Scam")}</h1>
        <p className="text-stone-600">{t("Submit suspicious messages to help protect your community.")}</p>
      </div>

      <div className="p-4 sm:p-7 shadow-sm border border-stone-200 rounded-xl bg-white max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <p role="alert" className="text-red-700">{language==='ta'?'Could not save the demo receipt. Please try again.':'Could not save the demo receipt. Please try again.'}</p>}
          <div>
            <label className="block text-sm font-medium text-black mb-2" htmlFor="report-text">{t("Suspicious Message or Link")}</label>
            <p className="text-sm text-black/60 mb-3 flex items-start gap-1.5 font-medium">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />{t("Please do not enter passwords or live OTPs. We attempt to mask common personal details automatically, but review your preview before submitting.")}</p>
            <textarea
              id="report-text"
              required
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full min-h-44 p-4 rounded-xl border border-stone-200 bg-stone-50 focus:ring-2 focus:ring-stone-500 focus:border-stone-500 outline-none resize-y text-black"
              placeholder={t("Paste the suspicious content here...")}
            />
            
            {text && (
              <div className="mt-4 p-4 bg-black/5 rounded-lg border border-black/5">
                <label className="block text-xs font-bold text-black/50 uppercase tracking-wider mb-2">{t("Review your masked report (This is what gets saved):")}</label>
                <p className="text-sm text-black/80 whitespace-pre-wrap break-words">{redactedPreview}</p>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-sm font-medium text-black mb-2" htmlFor="region-select">{t("Your Neighborhood")}</label>
                <select 
                  id="region-select"
                  required
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full min-h-[48px] p-3 rounded-lg border border-stone-200 bg-stone-50 focus:ring-2 focus:ring-stone-500 outline-none text-black"
                >
                  <option value="" disabled>{t("Select Neighborhood")}</option>
                  {REGIONS.map(r => <option key={r} value={r}>{t(r)}</option>)}
                </select>
              </div>
              {region === 'Other' && (
                <div>
                  <input
                    type="text"
                    required
                    placeholder={t("Enter your neighborhood/place")}
                    value={customRegion}
                    onChange={(e) => setCustomRegion(e.target.value)}
                    className="w-full min-h-[48px] p-3 rounded-lg border border-stone-200 bg-stone-50 focus:ring-2 focus:ring-stone-500 outline-none text-black"
                  />
                </div>
              )}
            </div>
            
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-sm font-medium text-black mb-2" htmlFor="category-select">{t("Scam Category")}</label>
                <select 
                  id="category-select"
                  required
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full min-h-[48px] p-3 rounded-lg border border-stone-200 bg-stone-50 focus:ring-2 focus:ring-stone-500 outline-none text-black"
                >
                  <option value="" disabled>{t("Select Category")}</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{t(c)}</option>)}
                </select>
              </div>
              {category === 'Other' && (
                <div>
                  <input
                    type="text"
                    required
                    placeholder={t("Enter category")}
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="w-full min-h-[48px] p-3 rounded-lg border border-stone-200 bg-stone-50 focus:ring-2 focus:ring-stone-500 outline-none text-black"
                  />
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="w-full min-h-[48px] bg-teal-700 hover:bg-teal-800 text-white py-3 rounded-full font-semibold transition-colors focus:outline-none focus:ring-4 focus:ring-teal-200"
          >{language==='ta'?'சரிபார்த்து தொடரவும்':'Review and continue'}</button>
        </form>
      </div>
    </div>
  );
}
