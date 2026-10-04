import { useLanguage } from '../lib/i18n';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, MessageSquare, MonitorSmartphone, Smartphone, AlertTriangle, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useRef } from 'react';
import { HowItWorksPrototype } from './HowItWorksPrototype';
import { BackgroundDotsCanvas } from '../components/InteractiveCanvas';

function FaqItem({ question, answer }: { question: string, answer: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-black/5 last:border-0">
      <button 
        className="w-full py-6 flex items-center justify-between text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-black rounded-sm"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span className="font-semibold text-lg text-black">{question}</span>
        {isOpen ? <ChevronUp className="w-5 h-5 text-black/50 shrink-0 ml-4" /> : <ChevronDown className="w-5 h-5 text-black/50 shrink-0 ml-4" />}
      </button>
      {isOpen && (
        <div className="pb-6 text-black/70 leading-relaxed text-base pr-8">
          {answer}
        </div>
      )}
    </div>
  );
}

function ScrollSpySection({ title, description, leftContent, children }: { title: string, description?: string, leftContent?: React.ReactNode, children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start center", "end center"]
  });
  
  return (
    <div ref={containerRef} className="w-full px-6 md:px-16 lg:px-12 xl:px-16 max-w-[1600px] mx-auto">
      <div className="flex flex-col lg:flex-row gap-10 lg:gap-20 items-start">
        {/* Left Column: Heading with Scroll Dot */}
        <div className="lg:w-1/3 lg:sticky lg:top-32 lg:shrink-0 flex gap-6 md:gap-8">
          <div className="hidden lg:block relative w-0.5 bg-black/10 rounded-full mt-3 mb-10 shrink-0">
            <motion.div 
              className="absolute top-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.8)]"
              style={{ top: useTransform(scrollYProgress, [0, 1], ["0%", "100%"]) }}
            />
          </div>
          <div className="w-full">
            <h2 className="text-3xl md:text-5xl font-bold text-black mb-4 tracking-tight">{title}</h2>
            {description && <p className="text-lg md:text-xl text-black/60 font-medium">{description}</p>}
            {leftContent}
          </div>
        </div>
        
        {/* Right Column: Content */}
        <div className="flex-1 w-full flex flex-col gap-8 min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}

export function Landing() {
  const { t, language } = useLanguage();
  const shouldReduceMotion = useReducedMotion();
  const location = useLocation();
  const hash = location.hash || '';
  const showAll = !hash || hash === '#home';

  return (
    <div className={"relative overflow-hidden selection:bg-indigo-100 "+(showAll?"min-h-screen":"min-h-0")}>
      {/* Top sections wrapper with solid background to obscure InteractiveCanvas */}
      <div className={(showAll || hash === '#home' || hash === '#how-it-works') ? 'bg-[#F9F8F6] relative z-10 pb-8' : ''}>
        {/* Background SVG is kept globally as decoration */}
      {(showAll || hash === '#home') && (
        <div className="absolute inset-x-0 top-0 h-[680px] pointer-events-none overflow-hidden" aria-hidden="true">
          <div className="absolute -top-48 -right-48 h-[520px] w-[520px] rounded-full bg-indigo-100/50 blur-3xl" />
          <div className="absolute top-48 -left-52 h-[420px] w-[420px] rounded-full bg-rose-100/35 blur-3xl" />
          <svg className="absolute inset-0 hidden h-full w-full sm:block" viewBox="0 0 1440 680" preserveAspectRatio="xMidYMin slice" fill="none">
            <defs>
              <linearGradient id="signal-left" x1="0" y1="0" x2="700" y2="440" gradientUnits="userSpaceOnUse">
                <stop stopColor="#e67a8a" stopOpacity=".5" />
                <stop offset="1" stopColor="#5359cf" stopOpacity=".13" />
              </linearGradient>
              <linearGradient id="signal-right" x1="1440" y1="0" x2="730" y2="480" gradientUnits="userSpaceOnUse">
                <stop stopColor="#454bd3" stopOpacity=".55" />
                <stop offset="1" stopColor="#454bd3" stopOpacity=".1" />
              </linearGradient>
            </defs>
            <motion.path d="M-80 40 C100 36 170 220 322 220 S520 290 612 380" stroke="url(#signal-left)" strokeWidth="1.5" animate={shouldReduceMotion ? {} : { y: [0, 11, 0], rotate: [0, .35, 0] }} transition={{duration:8,repeat:Infinity,ease:'easeInOut'}} />
            <motion.path d="M1510 76 C1280 84 1270 238 1118 232 S930 298 824 388" stroke="url(#signal-right)" strokeWidth="1.5" animate={shouldReduceMotion ? {} : { y: [0, -12, 0], rotate: [0, -.4, 0] }} transition={{duration:9.5,repeat:Infinity,ease:'easeInOut',delay:.4}} />
            <motion.path d="M-25 575 C200 500 370 525 530 472" stroke="#e67a8a" strokeOpacity=".22" strokeWidth="1" strokeDasharray="3 9" animate={shouldReduceMotion ? {} : { y: [0, -8, 0] }} transition={{duration:10,repeat:Infinity,ease:'easeInOut'}} />
            <motion.path d="M1460 550 C1220 475 1050 520 905 465" stroke="#454bd3" strokeOpacity=".22" strokeWidth="1" strokeDasharray="3 9" animate={shouldReduceMotion ? {} : { y: [0, 9, 0] }} transition={{duration:8.8,repeat:Infinity,ease:'easeInOut',delay:.8}} />
            {[[105,94,3],[248,201,4],[384,244,2],[1218,176,3],[1116,232,4],[994,286,2],[210,505,2],[1234,498,2]].map(([cx,cy,r],i) => <circle key={i} cx={cx} cy={cy} r={r} fill={i < 4 ? '#d9758e' : '#5459d8'} opacity=".56" />)}
          </svg>
        </div>
      )}

      {/* Conditional Rendering of Sections */}
      
      {/* Hero Section */}
      {(showAll || hash === '#home') && (
        <section className="relative min-h-[calc(100svh-4rem)] px-4 py-8 md:py-16 max-w-6xl mx-auto text-center flex flex-col items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-4 md:mb-7 flex items-center justify-center gap-3 text-indigo-900"
          >
            <span className="flex h-10 w-10 items-center justify-center md:h-12 md:w-12"><ShieldCheck className="h-6 w-6 md:h-7 md:w-7 stroke-[1.7]" /></span>
            <span className="hidden sm:inline font-display text-xl font-semibold tracking-[-.04em] text-[#171827]">{t("ThoondilGuard")}</span>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: shouldReduceMotion ? 0 : 0.05 }}
            className="mb-3 md:mb-5 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/5 text-black/70 text-xs md:text-sm font-semibold tracking-wide"
          >{t("Built for South Chennai communities")}</motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: shouldReduceMotion ? 0 : 0.1 }}
            className="text-[1.9rem] sm:text-5xl md:text-[3.25rem] lg:text-[4.5rem] font-semibold tracking-[-.015em] sm:tracking-[-.04em] text-[#171827] mb-3 md:mb-6 leading-[1.25] md:leading-[1.1] lg:leading-[1.08]"
          >
            <span className={`block ${language === 'en' ? 'md:whitespace-nowrap' : ''}`}>{t("Got a suspicious message?")}</span>{' '}<span className={`block ${language === 'en' ? 'md:whitespace-nowrap' : ''}`}>{t("Check it before you act.")}</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: shouldReduceMotion ? 0 : 0.2 }}
            className="text-base md:text-xl text-black/70 mb-6 md:mb-10 max-w-2xl font-medium leading-relaxed"
          >{t("Paste a message or upload a screenshot. See the warning signs and a safer next step in plain language.")}</motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: shouldReduceMotion ? 0 : 0.3 }}
            className="flex flex-col items-center w-full sm:w-auto z-10"
          >
            <Link 
              to="/check"
              className="w-full sm:w-auto px-8 py-3.5 md:py-4 bg-black text-white rounded-lg font-semibold text-base md:text-lg hover:bg-black/90 transition-all focus:outline-none focus:ring-4 focus:ring-black/20 flex items-center justify-center gap-2 shadow-sm min-h-[48px]"
            >{t("Open Portal")}<ArrowRight className="w-5 h-5" />
            </Link>
            <a href="#how-it-works" className="mt-4 md:mt-6 text-sm font-semibold text-black/60 hover:text-black transition-colors focus:outline-none focus:underline">{t("See how it works")}</a>
          </motion.div>
        </section>
      )}
      {/* How it works */}
      {(showAll || hash === '#how-it-works') && (
        <div id="how-it-works" className={showAll ? "mt-4" : "mt-0"}>
          <HowItWorksPrototype />
        </div>
      )}
      </div>

      {/* Ways to use */}
      {(showAll || hash === '#ways-to-use') && (
        <>
          <div className="mx-auto flex w-full max-w-7xl flex-wrap justify-center gap-3 px-4 py-6" aria-label={language === 'ta' ? 'சமூக சேவைகள்' : 'Community services'}>{[['/check','Check a message','மெசேஜைச் சரிபார்'],['/analyst','Threat intelligence demo','அச்சுறுத்தல் தகவல் மாதிரி'],['/alerts','Scam alerts demo','மோசடி எச்சரிக்கை மாதிரி'],['/extension','Browser extension','உலாவி நீட்டிப்பு'],['/report','Report a scam','புகாரளிக்க'],['/track','Track report','புகாரின் நிலை']].map(([to,en,ta])=><Link key={to} to={to} className="inline-flex min-h-11 items-center rounded-full border border-stone-200 bg-white px-4 text-sm font-medium text-teal-800 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700">{language==='ta'?ta:en}</Link>)}</div>
          <section id="ways-to-use" className="landing-section bg-[#F9F8F6] relative overflow-hidden">
            <BackgroundDotsCanvas />
            <ScrollSpySection 
              title={t("Ways to use ThoondilGuard")} 
              description={t("Use the portal now. More ways to check are planned.")}
            >
              {/* 1. Mobile Web App */}
              <div className="bg-white p-6 md:p-10 rounded-2xl border border-black/5 flex flex-col md:flex-row gap-6 md:gap-10 items-start md:items-center shadow-[0_8px_32px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)] transition-shadow">
                <div className="w-14 h-14 bg-indigo-50/80 rounded-2xl flex items-center justify-center shrink-0 border border-white/50 shadow-sm">
                  <Smartphone className="w-7 h-7 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-black mb-2">{t("Mobile Web App")}</h3>
                  <p className="text-black/70 font-medium mb-4 leading-relaxed">{t("The primary experience. Check messages instantly from your phone browser without installing anything.")}</p>
                  <Link to="/check?install=1" className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors focus:outline-none focus:underline">{t("Open Portal")}<ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
              
              {/* 2. WhatsApp guided support */}
              <div className="bg-white p-6 md:p-10 rounded-2xl border border-black/5 flex flex-col md:flex-row gap-6 md:gap-10 items-start md:items-center shadow-[0_8px_32px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)] transition-shadow relative overflow-hidden">
                <div className="w-14 h-14 bg-emerald-50/80 rounded-2xl flex items-center justify-center shrink-0 border border-white/50 shadow-sm">
                  <MessageSquare className="w-7 h-7 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-black">{language === "ta" ? "WhatsApp உதவி" : "WhatsApp support"}</h3>
                    <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-full uppercase tracking-wider">{language === "ta" ? "வழிகாட்டப்பட்ட அனுப்பல்" : "Guided handoff"}</span>
                  </div>
                  <p className="text-black/70 font-medium leading-relaxed">{language === "ta" ? "பிரச்சனையை விளக்கி, screenshot-ஐ தயார் செய்து, குறிப்பு எண்ணுடன் WhatsApp-ல் தொடரலாம்." : "Describe the issue, prepare a screenshot and continue in WhatsApp with a support reference."}<Link to="/help?channel=whatsapp" className="mt-3 block text-emerald-800 underline">{language === "ta" ? "WhatsApp உதவியைத் தொடங்கு" : "Start WhatsApp support"}</Link></p>
                </div>
              </div>

              {/* 3. Browser Extension */}
              <div className="bg-white p-6 md:p-10 rounded-2xl border border-black/5 flex flex-col md:flex-row gap-6 md:gap-10 items-start md:items-center shadow-[0_8px_32px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)] transition-shadow relative overflow-hidden">
                <div className="w-14 h-14 bg-purple-50/80 rounded-2xl flex items-center justify-center shrink-0 border border-white/50 shadow-sm">
                  <MonitorSmartphone className="w-7 h-7 text-purple-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-black">{t("Browser Extension")}</h3>
                    <span className="px-2.5 py-0.5 bg-black/5 text-black/60 text-xs font-bold rounded-full uppercase tracking-wider">{language === "ta" ? "சோதனை பதிப்பு" : "Developer preview"}</span>
                  </div>
                  <p className="text-black/70 font-medium leading-relaxed">{language === "ta" ? "நீங்கள் தேர்ந்தெடுக்கும் வலைப்பக்கத்தைப் படம்பிடித்து, உரையைச் சரிபார்த்து முடிவைப் பார்க்கலாம்." : "Manually capture a page, review its text and open the full check in ThoondilGuard."}<Link to="/extension" className="mt-3 block text-teal-800 underline">{language === "ta" ? "நீட்டிப்பைப் பெற" : "Get browser extension"}</Link></p>
                </div>
              </div>
            </ScrollSpySection>
          </section>

          <section className="landing-section landing-section--community bg-white border-y border-black/5 py-16 md:py-24">
            <div className="w-full px-6 md:px-16 lg:px-12 xl:px-16 max-w-[1600px] mx-auto flex flex-col lg:flex-row items-center gap-10 lg:gap-20">
              <div className="lg:w-1/2 flex justify-center w-full lg:order-last">
                <div className="relative h-[350px] w-full max-w-[420px] overflow-hidden rounded-3xl border border-stone-200 bg-[#faf9f7] shadow-[0_18px_50px_rgba(37,34,44,.06)]" aria-label={t("Illustration: several similar reports form a community warning")}>
                  <span className="absolute left-5 top-4 text-[10px] font-bold uppercase tracking-[.16em] text-stone-500">{t("Illustrative flow")}</span>
                  <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 420 350" fill="none" aria-hidden="true">
                    {[[96,110],[310,110],[98,260]].map(([x,y], index) => <motion.path key={index} d={`M${x} ${y} Q210 ${y} 210 185`} stroke={['#d38b56','#9b7ad1','#5d9f8a'][index]} strokeWidth="2" strokeDasharray="5 6" initial={shouldReduceMotion ? false : { pathLength: 0 }} animate={shouldReduceMotion ? { pathLength: 1 } : { pathLength: [0, 0, 1, 1, 0] }} transition={shouldReduceMotion ? { duration: 0 } : { duration: 8, repeat: Infinity, times: [0, .18 + index * .06, .46 + index * .06, .82, 1], ease: 'easeInOut' }} />)}
                  </svg>
                  {[
                    { label: 'Bill cutoff', color: 'bg-amber-50 border-amber-200 text-amber-800', position: 'left-6 top-16', x: -18, y: -10, delay: 0 },
                    { label: 'Pay now', color: 'bg-rose-50 border-rose-200 text-rose-800', position: 'right-6 top-16', x: 18, y: -10, delay: .07 },
                    { label: 'Same link', color: 'bg-emerald-50 border-emerald-200 text-emerald-800', position: 'left-6 bottom-12', x: -18, y: 12, delay: .14 },
                  ].map((report) => <motion.div key={report.label} className={`absolute ${report.position} z-10 rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm ${report.color}`} initial={false} animate={shouldReduceMotion ? { opacity: 1, x: 0, y: 0 } : { opacity: 1, x: [report.x, 0, 0, 0, report.x], y: [report.y, 0, 0, 0, report.y] }} transition={shouldReduceMotion ? { duration: 0 } : { duration: 8, repeat: Infinity, times: [0, .12 + report.delay, .5, .84, 1], ease: 'easeInOut' }}>{t(report.label)}</motion.div>)}
                  <div className="absolute left-1/2 top-1/2 z-20 w-[220px] -translate-x-1/2 -translate-y-1/2">
                    <motion.div className="rounded-2xl border border-stone-200 bg-white p-5 text-left shadow-[0_14px_35px_rgba(49,42,51,.15)]" initial={shouldReduceMotion ? false : { opacity: 0, scale: .84 }} animate={shouldReduceMotion ? { opacity: 1, scale: 1 } : { opacity: [0, 0, 0, 1, 1, 0], scale: [.84, .84, .84, 1, 1, .9] }} transition={shouldReduceMotion ? { duration: 0 } : { duration: 8, repeat: Infinity, times: [0, .2, .42, .55, .82, 1], ease: 'easeOut' }}>
                      <div className="mb-2 flex items-center gap-2 text-rose-700"><AlertTriangle className="h-5 w-5"/><span className="text-[11px] font-bold uppercase tracking-wide">{t("Community warning")}</span></div>
                      <p className="text-base font-semibold leading-snug text-[#24283b]">{t("Similar reports nearby")}</p>
                      <p className="mt-1.5 text-sm leading-snug text-stone-600">{t("Check through the official service.")}</p>
                    </motion.div>
                  </div>
                </div>
              </div>
              <div className="lg:w-1/2 text-left">
                <h2 className="text-3xl md:text-5xl font-bold text-black mb-6 tracking-tight">{t("Stronger together")}</h2>
                <p className="text-lg md:text-xl text-black/70 leading-relaxed font-medium mb-6">{t("When residents report similar suspicious messages, ThoondilGuard can help reveal a campaign affecting nearby communities.")}</p>
                <p className="text-lg md:text-xl text-black/70 leading-relaxed font-medium mb-8">{t("We attempt to mask common personal details before saving a report. Review the preview before submitting to ensure it is safe to share.")}</p>
                <Link to="/about" className="inline-flex items-center gap-2 text-indigo-700 font-bold hover:text-indigo-900 transition-colors focus:outline-none focus:underline text-lg">{t("Read about our privacy approach")}<ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </section>
        </>
      )}

      {/* FAQ Section */}
      {(showAll || hash === '#faq') && (
        <section id="faq" className="landing-section landing-section--compact bg-[#F9F8F6]">
          <ScrollSpySection 
            title={t("Frequently Asked Questions")}
          >
            <div className="bg-white rounded-2xl border border-black/5 px-6 md:px-10 shadow-[0_8px_32px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)] transition-shadow">
              <FaqItem 
                question={t("Does this replace official police reporting?")} 
                answer={t("No. ThoondilGuard is an early-warning and educational tool. If you have lost money or fallen victim to a crime, please contact your bank and the National Cyber Crime Reporting Portal (cybercrime.gov.in) immediately.")} 
              />
              <FaqItem 
                question={t("Do I need to install an app?")} 
                answer={t("Not right now. The primary experience is a mobile web app you can use directly in your browser. The browser extension is available as a developer preview; WhatsApp integration is planned.")} 
              />
              <FaqItem 
                question={t("Is my personal information safe?")} 
                answer={t("We prioritize your privacy. The initial check happens securely, and if you choose to report a message, our system attempts to mask common personal details (like phone numbers) before saving it. You will always see a preview of what will be shared before you confirm.")} 
              />
              <FaqItem 
                question={t("Can I upload screenshots?")} 
                answer={t("You can choose or drop a PNG, JPG, or WebP screenshot. Text extraction may make mistakes, so review the extracted message and correct any links before checking it.")} 
              />
              <FaqItem 
                question={t("Is this only for South Chennai?")} 
                answer={t("This prototype was designed with South Chennai communities in mind, tailoring guidance and examples to the region. However, the core verification principles apply broadly.")} 
              />
            </div>
          </ScrollSpySection>
        </section>
      )}
    </div>
  );
}


