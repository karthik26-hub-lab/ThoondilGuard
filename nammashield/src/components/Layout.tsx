import { useLanguage } from '../lib/i18n';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Menu, X, ArrowRight, ShieldCheck } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useInstalled } from '../lib/pwa';

export function Layout() {
  const { t, language, setLanguage } = useLanguage();
  const location = useLocation(); const installed=useInstalled();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [largeText,setLargeText]=useState(()=>localStorage.getItem('thg-large-text')==='true');
  useEffect(()=>{document.documentElement.dataset.largeText=String(largeText);localStorage.setItem('thg-large-text',String(largeText));},[largeText]);
  useEffect(()=>{setMobileMenuOpen(false);const timer=setTimeout(()=>{if(!location.hash)document.getElementById('main-content')?.focus();},100);return()=>clearTimeout(timer)},[location.pathname]);
  useEffect(()=>{if(!mobileMenuOpen)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape'){setMobileMenuOpen(false);document.querySelector<HTMLButtonElement>('[aria-controls="mobile-navigation"]')?.focus();}};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close)},[mobileMenuOpen]);
  const isPortal = !['/', '/about', '/prototype'].includes(location.pathname);

  const navItems = !isPortal 
    ? [
        { path: '/#how-it-works', label: 'How it works' },
        { path: '/#ways-to-use', label: 'Ways to use' },
        { path: '/#faq', label: 'FAQ' },
        { path: '/about', label: 'About' },
      ]
    : [
        { path: '/check', label: 'Analyze' },
        { path: '/analyst', label: 'Threat Intelligence' },
        { path: '/report', label: 'Report Scam' },
        { path: '/track', label: 'Track Report' },
        { path: '/alerts', label: 'Scam Alerts' },
      ];

  return (
    <div className="min-h-screen flex flex-col font-sans bg-[#F9F8F6]">
      
      <a href="#main-content" className="skip-link">{language==='ta'?'முக்கிய உள்ளடக்கத்திற்குச் செல்லவும்':'Skip to main content'}</a>
      <header className="sticky top-0 z-50 bg-[#F9F8F6]/80 backdrop-blur-md border-b border-black/5">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 min-h-16 flex items-center justify-between gap-3">
          <Link to={installed ? '/check' : '/'} className="flex items-center gap-1.5 shrink-0 focus:outline-none focus:ring-2 focus:ring-black rounded-md" onClick={() => setMobileMenuOpen(false)}>
            <ShieldCheck className="w-6 h-6 sm:w-7 sm:h-7 text-black stroke-[2]" />
            <span className="font-bold text-[15px] sm:text-xl tracking-tight text-black font-display">{t("ThoondilGuard")}</span>
          </Link>

          {/* Desktop Nav */}
          <nav className={`${installed ? 'hidden' : 'hidden lg:flex'} gap-4 xl:gap-6 items-center`}>
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.path}
                className="text-sm font-medium text-black/70 hover:text-black transition-colors whitespace-nowrap"
              >
                {language === 'ta' && item.label === 'How it works' ? 'செயல்முறை' : t(item.label)}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <button type="button" aria-pressed={largeText} aria-label={language==='ta'?'பெரிய எழுத்து':'Larger text'} onClick={()=>setLargeText(!largeText)} className="min-h-11 min-w-11 rounded-lg border border-stone-300 text-sm font-semibold">A+</button>
            <button type="button" lang={language === 'en' ? 'ta' : 'en'} aria-label={language === 'en' ? 'Switch to Tamil' : 'ஆங்கிலத்திற்கு மாற்று'} onClick={() => setLanguage(language === 'en' ? 'ta' : 'en')} className="flex h-11 items-center rounded-lg px-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><span className="inline-flex h-7 items-center rounded-full border border-stone-200 bg-white px-3 text-xs font-semibold leading-none shadow-sm transition-colors hover:bg-stone-100">{language === 'en' ? 'தமிழ்' : 'EN'}</span></button>
            {!isPortal && (
              <Link 
                to="/check" 
                className={`${installed ? 'hidden' : 'hidden lg:flex'} items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-black hover:bg-black/90 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 whitespace-nowrap`}
              >{t("Open Portal")}</Link>
            )}

          {/* Mobile menu toggle */}
          <button 
            className={`${installed ? 'hidden' : 'flex lg:hidden'} h-11 w-11 shrink-0 items-center justify-center p-0 text-black bg-black/5 rounded-full hover:bg-black/10 transition-colors focus:outline-none focus:ring-2 focus:ring-black`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)} onKeyDown={e=>{if(e.key==='Escape')setMobileMenuOpen(false)}}
            aria-label={t("Toggle menu")} aria-expanded={mobileMenuOpen} aria-controls="mobile-navigation"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && !installed && (
          <nav id="mobile-navigation" aria-label={language==='ta'?'வழிசெலுத்தல்':'Mobile navigation'} className="lg:hidden bg-[#F9F8F6] border-t border-black/5 px-4 py-4 flex flex-col gap-2 absolute w-full shadow-lg">
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-3 rounded-md text-base font-medium text-black/80 hover:bg-black/5 transition-colors"
              >
                {t(item.label)}
              </Link>
            ))}
            {!isPortal && (
              <Link
                to="/check"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-4 px-4 py-3 rounded-full text-base font-medium flex items-center justify-center gap-2 text-white bg-black focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
              >{t("Open Portal")}<ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </nav>
        )}
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full flex flex-col">
        {location.pathname === '/' || location.pathname === '/prototype' || location.pathname === '/check' || location.pathname === '/about' ? (
          <Outlet />
        ) : (
          <div className="w-full max-w-3xl mx-auto px-4 py-6 md:py-10">
            <Outlet />
          </div>
        )}
      </main>

      {/* Global Check a Message Footer Action */}
      {!installed && (
        <section className="relative overflow-hidden border-t border-black/5 px-4 py-8 text-center md:py-10 mt-auto">
          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="mb-6 text-3xl font-semibold tracking-tight text-[#171827] md:text-4xl">{t("Have a message you’d like to check?")}</h2>
            <Link 
              to="/check"
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-[#171827] px-8 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-indigo-900 focus:outline-none focus:ring-4 focus:ring-indigo-200 sm:w-auto"
            >{t("Check a message")}<ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </section>
      )}

      <footer className={`${installed ? 'hidden' : ''} border-t border-black/5 py-12 relative z-10 bg-[#F9F8F6]`}>
        <div className="w-full px-6 md:px-16 lg:px-12 xl:px-16 max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between text-sm text-black/60 gap-8">
          <div className="max-w-md">
            <p className="font-semibold text-black text-base mb-2">{t("ThoondilGuard Platform")}</p>
            <p className="mb-2 font-medium">{t("A platform to verify suspicious messages and links.")}</p>
            <p className="font-medium text-black/50">{t("Built by Team Astra")}</p>
          </div>
          <div className="flex flex-col md:flex-row gap-4 md:gap-8 md:text-right md:items-center">
            <Link to="/track" className="hover:text-black font-semibold transition-colors">{language === 'ta' ? 'புகாரின் நிலை' : 'Track report'}</Link>
            <Link to="/extension" className="hover:text-black font-semibold transition-colors">{language === 'ta' ? 'உலாவி நீட்டிப்பு' : 'Browser extension'}</Link>
            <Link to="/report" className="hover:text-black font-semibold transition-colors">{t("Report")}</Link>
            <Link to="/alerts" className="hover:text-black font-semibold transition-colors">{t("Local Alerts")}</Link>
            <Link to="/help" className="hover:text-black font-semibold transition-colors">{language === 'ta' ? 'வழிகாட்டப்பட்ட உதவி' : 'Guided help'}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

