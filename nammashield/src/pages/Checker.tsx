import { useLanguage } from '../lib/i18n';
import { useRef, useState } from 'react';
import { GlassCard } from '../components/GlassCard';
import { redactPII } from '../lib/detector';
import { analyzeMessage, hasBackend } from '../lib/api';
import { InstallHelp } from '../components/InstallHelp';
import { Info, ArrowRight, ImagePlus } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

export function Checker() {
  const { t, language } = useLanguage();
  const location=useLocation();

  const [error,setError]=useState('');
  const [input, setInput] = useState((location.state as {input?:string}|null)?.input??'');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const readScreenshot = async (file?: File) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setUploadMessage('Choose a PNG, JPG, or WebP screenshot. PDFs and APK files are not supported.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadMessage('Choose an image smaller than 10 MB.');
      return;
    }
    setIsExtracting(true);
    setError('');
    setUploadMessage('Reading the screenshot on this device. The first scan may take longer.');
    let worker: Awaited<ReturnType<typeof import('tesseract.js').createWorker>> | undefined;
    try {
      const { createWorker } = await import('tesseract.js');
      worker = await createWorker('eng', 1, {workerPath: '/ocr/worker.min.js', corePath: '/ocr', langPath: '/ocr', gzip: false});
      const { data } = await worker.recognize(file);
      if (!data.text.trim()) {
        setUploadMessage('No readable text found. Try a clearer screenshot or paste the message instead.');
        return;
      }
      setInput(previous => [previous.trim(), data.text.trim()].filter(Boolean).join('\n\n'));

      setUploadMessage('Text extracted. Please correct any mistakes, especially links, before checking.');
    } catch {
      setUploadMessage('Could not read this screenshot. Try a clearer image or paste the message instead.');
    } finally {
      await worker?.terminate();
      setIsExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCheck = async () => {
    if (!input.trim() || isExtracting || isAnalyzing) return;
    setIsAnalyzing(true); setError('');
    try { const redactedText=redactPII(input); const result=await analyzeMessage(hasBackend?redactedText:input,language);
      navigate('/check/result',{state:{result,redactedText,input}});
    } catch {setError('Could not complete this check. Please try again.');}
    finally {setIsAnalyzing(false);}
  };
  const loadExample = (type: 'delivery' | 'utility' | 'safe') => {
    if (type === 'delivery') setInput("India Post: Your parcel is on hold at Chennai Central hub. Pay ₹15 customs fee immediately via http://indiapost-chennai-delivery.info to avoid return.");
    if (type === 'utility') setInput("Dear customer, your TNEB bill is pending. Power will be cut at 9:00 PM. Update your payment here: http://tneb-online-update.com");
    if (type === 'safe') setInput("Anna, nan OMR le iruken. Traffic ah iruku, will reach by 6 PM.");
    setError('');
  };

 return <div>
 <div className="mx-auto max-w-2xl px-4 pt-8 pb-12 sm:pt-12">
 <InstallHelp/>
 <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">{t('Check a message')}</h1>
 <p className="mt-3 mb-7 text-stone-600">{t('Paste a message or upload a screenshot to check for common warning signs of fraud.')}</p>
 <GlassCard className="p-4 sm:p-7 border border-stone-200 shadow-sm">
 <label htmlFor="message-input" className="block mb-2 text-sm font-medium">{t('Message, link, or extracted text to check')}</label>
 <div onDragOver={e=>{e.preventDefault();if(!isAnalyzing&&!isExtracting)setIsDragging(true);}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setIsDragging(false);}} onDrop={e=>{e.preventDefault();setIsDragging(false);if(!isExtracting&&!isAnalyzing)void readScreenshot(e.dataTransfer.files[0]);}} className={`overflow-hidden rounded-2xl border transition-colors ${isDragging?'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100':'border-stone-200 bg-stone-50'}`}>
 <textarea id="message-input" value={input} disabled={isAnalyzing||isExtracting} onChange={e=>{setInput(e.target.value);setError('');}} onPaste={e=>{const items=e.clipboardData?.items;if(!items)return;for(let i=0;i<items.length;i++){if(items[i].type.indexOf('image')!==-1){e.preventDefault();const file=items[i].getAsFile();if(file&&!isExtracting&&!isAnalyzing){void readScreenshot(file);}break;}}}} placeholder={t('Paste your message here, or drop a screenshot.')} className="block w-full min-h-44 resize-y bg-transparent p-4 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"/>
 <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 px-3 py-2">
 <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={isExtracting||isAnalyzing} onChange={e=>void readScreenshot(e.target.files?.[0])}/>
 <button type="button" disabled={isExtracting||isAnalyzing} onClick={()=>fileInputRef.current?.click()} className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium hover:bg-white focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"><ImagePlus size={18}/>{t(isExtracting?'Reading screenshot…':'Add screenshot')}</button>
 <span className="px-2 text-xs text-stone-500">PNG, JPG, WebP · 10 MB</span>
 </div></div>
 {uploadMessage&&<p role="status" className="mt-3 text-sm text-stone-600">{t(uploadMessage)}</p>}
 <details className="mt-4 text-sm"><summary className="cursor-pointer min-h-11 flex items-center text-stone-600">{t('Try an example')}</summary><p className="text-xs text-stone-500 mb-2">{t('Illustrative example')}</p><div className="flex flex-wrap gap-2">{(['delivery','utility','safe'] as const).map((item,i)=><button disabled={isAnalyzing||isExtracting} key={item} onClick={()=>{loadExample(item);}} className="min-h-11 rounded-lg border px-3">{t(['Suspicious delivery','Suspicious utility','Everyday message'][i])}</button>)}</div></details>
 <button onClick={()=>void handleCheck()} disabled={!input.trim()||isAnalyzing||isExtracting} className="mt-5 flex w-full min-h-13 items-center justify-center gap-2 rounded-full bg-teal-700 hover:bg-teal-800 text-white font-semibold disabled:opacity-40 focus-visible:ring-4 focus-visible:ring-teal-200">{t(isAnalyzing?'Checking...':'Check this message')}<ArrowRight size={18}/></button>
 {error&&<p role="alert" className="mt-3 text-sm text-red-700">{t(error)}</p>}
 <p className="mt-4 text-xs text-stone-500 flex gap-2"><Info size={15} className="shrink-0"/>{t(hasBackend?'Common personal details are masked before sending.':'Demo check: common warning signs, not a guaranteed verdict.')}</p>
 </GlassCard>
 <details className="mt-5 rounded-xl border border-stone-200 bg-white px-4 text-sm text-stone-600">
 <summary className="flex min-h-12 cursor-pointer items-center font-medium text-stone-800">{language==='en'?'Need help checking?':'சரிபார்க்க உதவி வேண்டுமா?'}</summary>
 <ol className="list-decimal space-y-2 pl-5 pb-4">
 <li>{language==='en'?'Paste your message or add a screenshot.':'மெசேஜை ஒட்டுங்கள் அல்லது ஸ்கிரீன்ஷாட்டைச் சேருங்கள்.'}</li>
 <li>{language==='en'?'Review the text, then tap Check this message.':'உரையைப் பார்த்து சரிசெய்து, சரிபார்க்கும் பொத்தானை அழுத்துங்கள்.'}</li>
 <li>{language==='en'?'Read the warning signs and verify through an official source.':'எச்சரிக்கை அறிகுறிகளைப் படித்து, அதிகாரப்பூர்வ வழியில் உறுதி செய்யுங்கள்.'}</li>
 </ol></details></div></div>;
}


