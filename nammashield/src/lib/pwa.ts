import { useEffect, useState } from 'react';
interface InstallEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{outcome:'accepted'|'dismissed'}>; }
let pending: InstallEvent | null=null;
window.addEventListener('beforeinstallprompt', event=>{event.preventDefault();pending=event as InstallEvent;window.dispatchEvent(new Event('install-ready'));});
window.addEventListener('appinstalled',()=>{pending=null;window.dispatchEvent(new Event('install-ready'));});
export function isInstalled(){return matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator & {standalone?:boolean}).standalone);}
export function useInstalled(){const [installed,setInstalled]=useState(isInstalled);useEffect(()=>{const media=matchMedia('(display-mode: standalone)');const update=()=>setInstalled(isInstalled());media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);return installed;}
export function canInstall(){return Boolean(pending);}
export async function installApp(){if(!pending)return 'unavailable';const event=pending;pending=null;window.dispatchEvent(new Event('install-ready'));await event.prompt();return(await event.userChoice).outcome;}
