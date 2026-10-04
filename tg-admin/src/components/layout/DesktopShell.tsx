import {adminConnected,adminRequest} from '../../lib/adminApi';
import {useWorkspace} from '../../lib/workspaceState';
import { useEffect, useRef, useState } from 'react';
import { Outlet, NavLink, Navigate, useLocation, useNavigate, Link } from 'react-router-dom';
import { LayoutDashboard, FileText, BarChart3, Users, BellRing, History, Settings, ShieldCheck, Search, Menu, X, Puzzle, LifeBuoy } from 'lucide-react';
import { useLanguage } from '../../lib/languageState';
const items = [{ path: '/overview', label: 'Overview', icon: LayoutDashboard }, { path: '/reports', label: 'Reports', icon: FileText }, { path: '/support', label: 'Support requests', icon: LifeBuoy }, { path: '/threat-intel', label: 'Threat intelligence', icon: BarChart3 }, { path: '/campaigns', label: 'Related reports', icon: Users }, { path: '/alerts', label: 'Alerts', icon: BellRing }, { path: '/extensions', label: 'Extensions', icon: Puzzle }, { path: '/audit', label: 'Activity history', icon: History }, { path: '/settings', label: 'Settings', icon: Settings }];
export function DesktopShell() {
    const { t, toggle, language } = useLanguage();
    const {loading,error,refresh}=useWorkspace();
    const [authenticated,setAuthenticated]=useState<boolean|null>(adminConnected?null:true);
    useEffect(()=>{if(!adminConnected)return;void adminRequest('/session').then(()=>{setAuthenticated(true);void refresh().catch(()=>{});}).catch(()=>setAuthenticated(false));const expired=()=>setAuthenticated(false);window.addEventListener('thg-session-expired',expired);return()=>window.removeEventListener('thg-session-expired',expired)},[]);
    const location = useLocation();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const drawer = useRef<HTMLElement>(null);
    useEffect(()=>{const close=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);document.getElementById('admin-menu-toggle')?.focus();}};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close)},[]);
    if(adminConnected&&authenticated===null)return <p role="status" className="p-8">{t('Checking administrator session…')}</p>;
    if (adminConnected?authenticated!==true:sessionStorage.getItem('thg-admin-demo-session') !== '1')
        return <Navigate to="/login" state={{ from: location.pathname }} replace/>;
    return <div className={"admin-shell min-h-screen bg-canvas "+(open?"nav-open":"")}><a href="#main-content" className="skip-link">{t('Skip to content')}</a>
    <aside ref={drawer} aria-label={t('Menu')} id="admin-navigation" className="admin-sidebar bg-panel border-r border-border flex flex-col"><div className="h-20 flex items-center px-5 border-b border-border gap-2"><ShieldCheck className="text-slate-700 shrink-0"/><div><p className="font-bold">ThoondilGuard</p><p className="text-sm text-text-secondary">{t('Administrator workspace')}</p></div><button className="lg:hidden secondary p-2" aria-label={t('Close menu')} onClick={() => setOpen(false)}><X size={18}/></button></div><nav className="flex-1 overflow-auto p-3 space-y-1">{items.map(item => <NavLink key={item.path} to={item.path} onClick={() => setOpen(false)} className={({ isActive }) => 'min-h-11 flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium ' + (isActive ? 'bg-slate-100 text-slate-900 font-semibold' : 'text-text-secondary hover:bg-panel-alt')}><item.icon size={18} className="shrink-0"/>{t(item.label)}</NavLink>)}</nav><div className="border-t border-border p-5 text-sm"><Link to="/settings#accessibility" className="text-primary underline">{t('Help & accessibility')}</Link><p className="mt-3 text-text-secondary">{t('Administrator')}</p></div></aside>
    <div className="admin-content min-w-0"><header className="min-h-16 bg-panel border-b border-border flex flex-wrap items-center gap-3 px-4 lg:px-8 py-3"><button id="admin-menu-toggle" className="secondary lg:hidden" aria-label={t('Menu')} aria-expanded={open} aria-controls="admin-navigation" onClick={() => setOpen(!open)}><Menu size={18}/></button><form onSubmit={e => { e.preventDefault(); navigate('/reports?q=' + encodeURIComponent(search)); }} className="flex-1 min-w-40 max-w-xl flex gap-3"><label className="sr-only" htmlFor="global-search">{t('Search reports')}</label><input id="global-search" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('Search reports')} className="min-w-0 w-full"/><button className="secondary" aria-label={t('Search')}><Search size={18}/></button></form><div className="flex items-center gap-2 ml-auto"><button onClick={toggle} className="secondary" lang={language === 'en' ? 'ta' : 'en'} aria-label={language === 'en' ? 'Switch to Tamil' : 'Switch to English'}>{language === 'en' ? 'தமிழ்' : 'EN'}</button><button className="secondary" onClick={async() => {
            if (window.confirm(t('Sign out') + '?')) {
                if(adminConnected){try{await adminRequest('/logout','POST',{});}catch{return;}}
                sessionStorage.removeItem('thg-admin-demo-session');
                navigate('/login', { replace: true });
            }
        }}>{t('Sign out')}</button></div></header><div className="border-b border-border bg-panel-alt px-4 lg:px-8 py-2 text-xs text-text-secondary">{t(adminConnected?'Server workspace — authenticated administrator access':'Backend not connected — sample records and local changes only.')}</div><main id="main-content" tabIndex={-1} className="p-4 lg:p-8 max-w-[1800px] mx-auto"><div aria-live="polite">{loading&&<p className="mb-4">{t('Loading reports…')}</p>}{error&&<div role="alert" className="mb-4 text-status-red-text"><p>{error}</p><button className="secondary mt-2" onClick={()=>void refresh().catch(()=>{})}>{t('Retry')}</button></div>}</div>{<Outlet />}</main></div></div>;
}
