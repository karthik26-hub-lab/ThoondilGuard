import { useLanguage } from '../lib/i18n';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, MotionConfig, useReducedMotion, useInView } from 'framer-motion';
import { AlertTriangle, ShieldCheck, Volume2, Pause, Globe, SquareTerminal, FileImage, MousePointer2, ExternalLink, CheckCircle2 } from 'lucide-react';

export function HowItWorksPrototype({ compact = false }: { compact?: boolean }) {
  const { t, language: lang, setLanguage: setLang } = useLanguage();
  const reduceMotion = useReducedMotion(); const sectionRef=useRef<HTMLElement>(null); const inView=useInView(sectionRef, { amount: 0.15 });
  const [step, setStep] = useState<0 | 1 | 2 | 3>(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [replay, setReplay] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
    setAudioError(false);
    setStep(1);
    setReplay((value) => value + 1);
  }, [lang]);

  const startAutoLoop = () => {
    stopAutoLoop();
    timerRef.current = setInterval(() => {
      setStep((prev) => (prev === 3 ? 1 : prev === 0 ? 1 : (prev + 1) as 1 | 2 | 3));
    }, 5000); 
  };

  const stopAutoLoop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  useEffect(() => {
    if (!isPlaying && inView && !reduceMotion) startAutoLoop();
    return stopAutoLoop;
  }, [isPlaying, inView, reduceMotion]);

  const toggleLanguage = () => {
    const newLang = lang === 'en' ? 'ta' : 'en';
    setLang(newLang);
    setAudioError(false);
    setStep(1);
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      setStep(1);
    }
  };

  const togglePlay = async () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      startAutoLoop();
    } else {
      stopAutoLoop();
      audioRef.current.currentTime = 0;
      setStep(1);
      setReplay((value) => value + 1);
      setAudioError(false);
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
        setAudioError(true);
        startAutoLoop();
      }
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const t = audioRef.current.currentTime;
    const d = audioRef.current.duration || 15;
    const p = t / d;

    if (t === 0) setStep(1);
    else if (p < 0.35) setStep(1);
    else if (p < 0.70) setStep(2);
    else setStep(3);
  };

  const handleAudioEnd = () => {
    setIsPlaying(false);
    startAutoLoop();
  };

  const handleTabClick = (s: 1 | 2 | 3) => {
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    }
    setStep(s);
    startAutoLoop();
  };

  return (
    <MotionConfig reducedMotion="user">
    <section ref={sectionRef} className={compact ? "bg-[#F9F8F6] py-12 overflow-hidden border-t border-black/5" : "min-h-screen bg-[#F9F8F6] pt-24 pb-32 overflow-hidden selection:bg-indigo-100 border-y border-black/5"}>
      
      <audio 
        ref={audioRef}
        src={lang === 'en' ? "/demo-en-v3.mp3" : "/demo-ta-v3.mp3"}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleAudioEnd}
        onError={() => { setIsPlaying(false); setAudioError(true); }}
        preload="metadata"
      />

      <div className="w-full px-6 md:px-16 lg:px-12 xl:px-16">
        
        {/* TOP ROW: Header (Left) & Controls (Right) */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-16 gap-8 lg:gap-12">
          
          {/* Left Top */}
          <div className="max-w-3xl text-left lg:flex-1">
            <h2 className="text-4xl md:text-5xl lg:text-5xl font-bold text-black mb-4 tracking-tight">{t("How it works")}</h2>
            <p className="text-xl md:text-2xl lg:text-xl text-black/60 font-medium">
              {lang === 'en' ? 'A quick check helps you decide what to verify next.' : 'அடுத்த கட்டத்தை தீர்மானிக்க ஒரு விரைவான சோதனை.'}
            </p>
          </div>
          
          {/* Right Top */}
          <div className="flex flex-wrap items-center gap-3 lg:shrink-0 lg:justify-end">
            <button 
              onClick={toggleLanguage}
              className="flex items-center gap-2 px-4 py-3 rounded-full text-sm font-bold bg-white border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors shadow-sm min-h-[44px]"
              disabled={isPlaying}
            >
              <Globe className="w-5 h-5" />
              {lang === 'en' ? 'English' : 'தமிழ்'}
            </button>
            
            <button 
              onClick={togglePlay}
              className={`flex items-center gap-2 px-5 py-3 rounded-full text-sm font-bold transition-all shadow-md min-h-[44px] ${isPlaying ? 'bg-rose-100 text-rose-600' : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105'}`}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Volume2 className="w-5 h-5" />}
              {isPlaying ? (lang === 'en' ? 'Pause' : 'நிறுத்து') : (lang === 'en' ? 'Play Narration' : 'குரலை இயக்கு')}
            </button>
          </div>
        </div>

        {audioError && <p role="status" className="mb-6 text-sm text-stone-600">{lang === 'en' ? 'Narration could not play. You can still follow the steps below.' : 'குரலை இயக்க முடியவில்லை. கீழே உள்ள படிகளைப் பார்க்கலாம்.'}</p>}

        <details className="mb-6 rounded-xl border border-stone-200 bg-white p-4"><summary className="cursor-pointer min-h-11 font-semibold">{lang==='en'?'Read all steps without animation or audio':'ஒலி அல்லது அசைவு இல்லாமல் அனைத்து படிகளையும் படிக்க'}</summary><ol className="mt-3 list-decimal space-y-3 pl-5"><li>{lang==='en'?'Paste a message or add a screenshot. Review the extracted text before checking.':'செய்தியை ஒட்டவும் அல்லது படத்தைச் சேர்க்கவும். சரிபார்ப்பதற்கு முன் எடுக்கப்பட்ட உரையைப் பார்க்கவும்.'}</li><li>{lang==='en'?'Review warning signs, such as pressure to act quickly or requests for private details. A result is not a guaranteed verdict.':'உடனடியாக செயல்படச் சொல்வது அல்லது தனிப்பட்ட விவரங்களைக் கேட்பது போன்ற எச்சரிக்கை அறிகுறிகளைப் பார்க்கவும். முடிவு உறுதியான தீர்ப்பு அல்ல.'}</li><li>{lang==='en'?'Verify through an official app, website or trusted contact. Review masked details before choosing to report.':'அதிகாரப்பூர்வ செயலி, இணையதளம் அல்லது நம்பகமான தொடர்பு மூலம் உறுதிசெய்யவும். புகார் அளிப்பதற்கு முன் மறைக்கப்பட்ட விவரங்களைப் பார்க்கவும்.'}</li></ol></details>
        {/* BOTTOM ROW: Animation (Left) & Steps (Right) */}
        <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-3 lg:gap-12 xl:gap-16 lg:items-center">
          
          {/* LEFT MID: The Landscape Motion Graphic */}
          <div className="w-full min-w-0 flex flex-col justify-center">
            <div 
              className="relative w-full min-h-[430px] lg:aspect-[16/10] rounded-[2rem] border border-stone-200 bg-white shadow-[0_20px_60px_rgba(37,34,44,.05)] flex items-center justify-center overflow-hidden group"
            >
              <div className="absolute inset-0 opacity-40 transition-opacity group-hover:opacity-60" style={{ backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
              <div className="absolute left-5 right-5 top-5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-stone-500 z-30"><span>{lang === 'en' ? 'Illustrative check' : 'விளக்க எடுத்துக்காட்டு'}</span><span className="rounded-full bg-stone-100 px-3 py-1">{step === 0 ? 'Ready' : `0${step} / 03`}</span></div>

              <AnimatePresence mode="wait">
                {step > 0 && (
                  <motion.div key={`simulation-${lang}-${replay}`} className="absolute inset-0 flex items-center justify-center">

                    <AnimatePresence>
                      {step === 1 && !reduceMotion && <motion.div key="screenshot-drop" aria-hidden="true" className="absolute z-40 flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-3 text-xs font-semibold text-indigo-700 shadow-xl" initial={{ x: -85, y: -80, opacity: 0, rotate: -8 }} animate={{ x: [-85, 0, 0], y: [-80, 0, 0], opacity: [0, 1, 0], rotate: [-8, 0, 0], scale: [1, 1, .8] }} exit={{ opacity: 0 }} transition={{ duration: 1.8, times: [0, .7, 1], ease: 'easeInOut' }}><FileImage className="h-5 w-5"/><span>{t("screenshot.png")}</span><MousePointer2 className="absolute -bottom-4 -right-3 h-6 w-6 fill-stone-900 text-white drop-shadow"/></motion.div>}
                    </AnimatePresence>
                    
                    {/* Steps 1 & 2 Abstract Document */}
                    <motion.div 
                      className="absolute inset-0 flex flex-col items-center justify-center gap-4 w-full px-5 py-14"
                      initial={{ x: 100, opacity: 0 }}
                      animate={{ 
                        x: step === 3 ? -400 : 0, 
                        opacity: step === 3 ? 0 : 1 
                      }}
                      transition={{ type: "spring", stiffness: 90, damping: 20 }}
                    >
                      <motion.div 
                        className="w-full max-w-[280px] lg:max-w-[380px] bg-white border border-stone-200 rounded-2xl p-5 lg:p-6 shadow-xl relative z-20 overflow-hidden"
                        initial={{ y: 0 }}
                        animate={{ y: 0 }}
                        transition={{ type: "spring", stiffness: 100, damping: 20 }}
                      >
                        <div className="flex items-center gap-3 text-stone-500 mb-3 pb-3 border-b border-stone-100">
                          <SquareTerminal className="w-5 h-5" />
                          <span className="text-sm font-bold uppercase tracking-wider">{lang === 'en' ? 'Pasted Message' : 'செய்தி'}</span>
                        </div>
                        
                        <motion.p key={step === 1 ? 'extracting' : 'extracted'} className="text-sm lg:text-base leading-relaxed text-stone-700">
                          <motion.span initial={{ opacity: step === 1 && !reduceMotion ? 0 : 1 }} animate={{ opacity: 1 }} transition={{ duration: .4, delay: step === 1 && !reduceMotion ? 2 : 0 }}>{lang === 'en' ? 'Your electricity bill is overdue. ' : 'உங்கள் மின் கட்டணம் நிலுவையில் உள்ளது. '}</motion.span>
                          <motion.span initial={{ opacity: step === 1 && !reduceMotion ? 0 : 1 }} animate={{ opacity: 1 }} transition={{ duration: .4, delay: step === 1 && !reduceMotion ? 2.4 : 0 }} className={`rounded px-1 transition-colors duration-700 ${step === 2 ? 'bg-amber-100 text-amber-900' : ''}`}>{lang === 'en' ? 'Pay immediately' : 'உடனே செலுத்தவும்'}</motion.span>
                          <motion.span initial={{ opacity: step === 1 && !reduceMotion ? 0 : 1 }} animate={{ opacity: 1 }} transition={{ duration: .4, delay: step === 1 && !reduceMotion ? 2.8 : 0 }}>{lang === 'en' ? ' using this link to avoid disconnection.' : ' இந்த இணைப்பில் செலுத்தி துண்டிப்பைத் தவிர்க்கவும்.'}</motion.span>
                        </motion.p>
                        {step === 2 && !reduceMotion && <motion.div aria-hidden="true" className="absolute inset-x-0 h-px bg-indigo-400 shadow-[0_0_16px_3px_rgba(99,102,241,.25)]" initial={{ top: '20%' }} animate={{ top: ['20%', '90%', '20%'] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }} />}
                        <motion.div key={step === 1 ? 'preparing' : 'ready'} initial={{ opacity: step === 1 && !reduceMotion ? 0 : 1 }} animate={{ opacity: 1 }} transition={{ delay: step === 1 && !reduceMotion ? 3.3 : 0 }} className="mt-3 flex items-center gap-1.5 text-[10px] font-medium text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5"/>{lang === 'en' ? 'Text ready to review' : 'செய்தியை ஆய்வு செய்யலாம்'}</motion.div>
                      </motion.div>

                      {/* Step 2 Insights Popups */}
                      <AnimatePresence>
                        {step === 2 && (
                          <motion.div 
                            className="relative w-full max-w-[280px] lg:max-w-[380px] flex flex-col gap-3 z-30 shrink-0"
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ type: "spring", stiffness: 120, damping: 15, delay: reduceMotion ? 0 : .7 }}
                          >
                            <div className="bg-rose-50 border border-rose-200 p-4 lg:p-5 rounded-xl flex items-center gap-4 shadow-lg">
                              <AlertTriangle className="w-6 h-6 lg:w-7 lg:h-7 text-rose-500 shrink-0" />
                              <div>
                                <div className="text-sm lg:text-base font-bold text-rose-700 mb-1">{lang === 'en' ? 'Pressure to act quickly' : 'அவசரப்படுத்தும் கோரிக்கை'}</div>
                                <p className="text-xs text-rose-700">{lang === 'en' ? 'Verify the payment request independently.' : 'கட்டணக் கோரிக்கையை தனியாகச் சரிபார்க்கவும்.'}</p>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>

                    {/* Step 3 Final Shield Screen */}
                    <motion.div 
                      className="absolute flex flex-col items-center justify-center w-full"
                      initial={{ x: 400, opacity: 0 }}
                      animate={{ 
                        x: step === 3 ? 0 : 400, 
                        opacity: step === 3 ? 1 : 0 
                      }}
                      transition={{ type: "spring", stiffness: 90, damping: 20 }}
                    >
                      <div className="w-16 h-16 lg:w-24 lg:h-24 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4 shadow-[0_12px_35px_rgba(16,185,129,.12)]">
                        <ShieldCheck className="w-9 h-9 lg:w-12 lg:h-12 text-emerald-600" />
                      </div>
                      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: step === 3 ? 1 : 0, y: step === 3 ? 0 : 12 }} transition={{ delay: reduceMotion ? 0 : .25 }} className="bg-white border border-stone-200 shadow-xl rounded-2xl p-5 lg:p-6 text-center max-w-[300px]">
                        <h4 className="font-bold text-emerald-700 mb-3 text-lg lg:text-xl">{lang === 'en' ? 'Safer next step' : 'பாதுகாப்பான முடிவு'}</h4>
                        <p className="text-sm leading-relaxed text-stone-600">{lang === 'en' ? 'Open the official electricity service yourself and check your bill there.' : 'அதிகாரப்பூர்வ மின்சார சேவையைத் திறந்து உங்கள் கட்டணத்தைச் சரிபார்க்கவும்.'}</p>
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: step === 3 ? 1 : 0, y: step === 3 ? 0 : 8 }} transition={{ delay: reduceMotion ? 0 : .7 }} className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800"><ExternalLink className="h-3.5 w-3.5"/>{lang === 'en' ? 'Use the official app or website' : 'அதிகாரப்பூர்வ ஆப் அல்லது இணையதளம்'}</motion.div>
                      </motion.div>
                    </motion.div>

                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* RIGHT MID: The Typography Steps */}
          <div className="w-full min-w-0 flex flex-col justify-center text-left">
            <div className="flex min-h-36 flex-col gap-0 lg:gap-7 lg:pl-4">
              {[1, 2, 3].map((num) => {
                const isActive = step === num;
                
                let title, desc;
                if (num === 1) {
                  title = lang === 'en' ? 'Paste or upload' : 'பதிவேற்றவும்';
                  desc = lang === 'en' ? 'Add the message, link, or screenshot you want to check.' : 'சந்தேகமாக இருக்கும் மெசேஜ், லிங்க் அல்லது ஸ்கிரீன்ஷாட்டைச் சேர்க்கலாம்.';
                } else if (num === 2) {
                  title = lang === 'en' ? 'Review insights' : 'ஆய்வு செய்தல்';
                  desc = lang === 'en' ? 'See what needs a closer look, such as pressure to pay quickly.' : 'உடனே பணம் கட்டச் சொல்வது போன்ற அறிகுறிகளைப் பாருங்கள்.';
                } else {
                  title = lang === 'en' ? 'Verify safely' : 'பாதுகாப்பான முடிவு';
                  desc = lang === 'en' ? 'Use the suggested next step to check through an official source.' : 'அதிகாரப்பூர்வ சேவையில் சரிபார்க்க அடுத்த படியைத் தெரிந்துகொள்ளலாம்.';
                }

                return (
                  <button
                    key={num}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => handleTabClick(num as 1|2|3)}
                    className={`transition-opacity duration-300 cursor-pointer relative gap-4 text-left rounded-xl p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-600 ${isActive ? 'flex opacity-100' : 'hidden lg:flex opacity-65 hover:opacity-100'}`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${isActive ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500'}`}>0{num}</span>
                    
                    <div>
                      <h3 className={`text-xl lg:text-2xl font-bold mb-2 tracking-tight ${isActive ? 'text-black' : 'text-stone-600'}`}>{title}</h3>
                      <p className="text-stone-500 font-medium text-base lg:text-lg leading-relaxed max-w-md lg:max-w-lg">
                        {desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </section>
    </MotionConfig>
  );
}


