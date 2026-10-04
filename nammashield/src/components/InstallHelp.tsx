import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Smartphone, X } from 'lucide-react';
import { useLanguage } from '../lib/i18n';
import { canInstall, installApp, useInstalled } from '../lib/pwa';
export function InstallHelp() {
 const {language}=useLanguage();const installed=useInstalled();const location=useLocation();
 const dialogRef=useRef<HTMLDialogElement>(null); const [dismissed,setDismissed]=useState(false);
 const [ready,setReady]=useState(canInstall);const [platform,setPlatform]=useState<'android'|'ios'|null>(null);const [status,setStatus]=useState('');
 useEffect(()=>{const update=()=>setReady(canInstall());window.addEventListener('install-ready',update);return()=>window.removeEventListener('install-ready',update);},[]);
 useEffect(()=>{if(!installed && new URLSearchParams(location.search).get('install')==='1')dialogRef.current?.showModal();},[installed,location.search]);
 if(installed)return null;const en=language==='en';
 return <>
 {!dismissed&&<div className="mb-6 flex items-center gap-2 rounded-xl border border-teal-100 bg-teal-50 px-3 py-2 text-sm">
 <Smartphone className="h-5 w-5 shrink-0 text-teal-700" aria-hidden="true"/><span className="flex-1 text-teal-900">{en?'Use ThoondilGuard as an app':'ThoondilGuard ஆப்பாகப் பயன்படுத்துங்கள்'}</span>
 <button type="button" onClick={()=>dialogRef.current?.showModal()} className="min-h-11 rounded-full bg-teal-700 px-4 text-white font-medium">{en?'Install':'நிறுவு'}</button>
 <button type="button" aria-label={en?'Dismiss install banner':'நிறுவல் அறிவிப்பை மறை'} onClick={()=>setDismissed(true)} className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-teal-800 hover:bg-teal-100"><X size={18}/></button>
 </div>}
 <dialog ref={dialogRef} aria-labelledby="install-title" className="fixed inset-x-0 bottom-0 top-auto m-0 w-full max-w-none max-h-[85dvh] overflow-y-auto rounded-t-3xl border border-stone-200 bg-white p-5 text-sm text-stone-600 shadow-xl backdrop:bg-black/30 md:inset-0 md:m-auto md:max-w-lg md:rounded-2xl md:p-7" onClick={e=>{if(e.target===e.currentTarget){const bounds=e.currentTarget.getBoundingClientRect();if(e.clientX<bounds.left||e.clientX>bounds.right||e.clientY<bounds.top||e.clientY>bounds.bottom)e.currentTarget.close();}}}>
 <div className="flex items-start justify-between gap-3"><h2 id="install-title" className="text-xl font-semibold text-stone-900">{en?'Install ThoondilGuard':'ThoondilGuard நிறுவுங்கள்'}</h2><button type="button" autoFocus onClick={()=>dialogRef.current?.close()} aria-label={en?'Close installation':'நிறுவல் வழிகாட்டியை மூடு'} className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-stone-100"><X size={18}/></button></div>
 <p className="mt-2">{en?'Add the checker to your home screen. No separate download needed.':'சரிபார்ப்பை உங்கள் முகப்புத் திரையில் சேருங்கள். தனியாகப் பதிவிறக்கத் தேவையில்லை.'}</p>
 <div className="flex flex-wrap gap-2 mt-4"><button onClick={()=>{setPlatform('android');setStatus('');}} className="min-h-11 rounded-full border px-4">Android</button><button onClick={()=>{setPlatform('ios');setStatus('');}} className="min-h-11 rounded-full border px-4">iPhone / iPad</button></div>
 {platform==='android'&&<div className="mt-4">{ready?<button className="min-h-11 rounded-full bg-teal-700 px-5 text-white" onClick={async()=>{try{const result=await installApp();setStatus(result==='accepted'?(en?'Installation accepted. Follow your browser’s instructions.':'நிறுவ ஒப்புதல் அளித்தீர்கள். உலாவியின் வழிமுறைகளைப் பின்பற்றுங்கள்.'):(en?'You can install later from the browser menu.':'பிறகு உலாவி மெனுவிலிருந்து நிறுவலாம்.'));}catch{setStatus(en?'Use the browser menu to install.':'உலாவி மெனுவிலிருந்து நிறுவுங்கள்.');}}}>{en?'Install app':'ஆப்பை நிறுவு'}</button>:<p>{en?'Open this site in Chrome on Android. Tap the browser menu, then Install app or Add to Home screen.':'Android Chrome-ல் இந்தத் தளத்தைத் திறந்து, மெனுவில் Install app அல்லது Add to Home screen தேர்வு செய்யுங்கள்.'}</p>}</div>}
 {platform==='ios'&&<p className="mt-4">{en?'Open this site in Safari. Tap Share, choose Add to Home Screen, then tap Add.':'Safari-ல் இந்தத் தளத்தைத் திறக்கவும். Share → Add to Home Screen → Add தேர்வு செய்யுங்கள்.'}</p>}
 {status&&<p role="status" className="mt-3">{status}</p>}
 <p className="py-4 text-xs text-stone-500">{en?'Installation requires a supported browser and HTTPS. Online checks and screenshot reading may need internet.':'நிறுவ ஆதரிக்கப்படும் உலாவியும் HTTPS-மும் தேவை. இணையச் சரிபார்ப்புக்கும் ஸ்கிரீன்ஷாட் வாசிப்புக்கும் இணையம் தேவைப்படலாம்.'}</p></dialog></>;
}

