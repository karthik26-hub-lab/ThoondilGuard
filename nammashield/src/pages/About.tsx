import { useLanguage } from '../lib/i18n';

export function About() {
  const { t } = useLanguage();
  return (
    <div className="w-full px-6 md:px-16 lg:px-12 xl:px-16 max-w-[1600px] mx-auto py-12 md:py-20">
      <div className="flex flex-col lg:flex-row gap-10 lg:gap-20 items-start">
        
        {/* Left Column: Heading */}
        <div className="lg:w-1/3 lg:sticky lg:top-32 lg:shrink-0">
          <h2 className="text-3xl md:text-5xl font-bold text-black mb-4 tracking-tight">{t("About ThoondilGuard")}</h2>
        </div>
        
        {/* Right Column: Content */}
        <div className="flex-1 w-full bg-white rounded-2xl border border-black/5 p-8 md:p-12 shadow-[0_8px_32px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)] transition-shadow space-y-10">
          <div>
            <h3 className="text-2xl font-bold text-black mb-3">{t("What is this?")}</h3>
            <p className="text-lg text-black/70 font-medium leading-relaxed">{t("ThoondilGuard is a Team Astra project exploring clearer fraud guidance and community awareness for South Chennai. Its goal is to provide a fast, accessible way to check suspicious messages and share them with the community.")}</p>
          </div>

          <div>
            <h3 className="text-2xl font-bold text-black mb-3">{t("Privacy first")}</h3>
            <p className="text-lg text-black/70 font-medium leading-relaxed">{t("We believe in protecting your data. When you check a message, the analysis happens directly in your browser. If you choose to submit a report, our system automatically redacts sensitive information like phone numbers and emails before saving it.")}</p>
          </div>
          
          <div>
            <h3 className="text-2xl font-bold text-black mb-3">{t("This is a prototype")}</h3>
            <p className="text-lg text-black/70 font-medium leading-relaxed">{t("Please note that this is a demonstration product created for a hackathon. It does not replace official police reporting. If you have been the victim of a financial crime, please contact your bank and the national cybercrime portal immediately.")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
