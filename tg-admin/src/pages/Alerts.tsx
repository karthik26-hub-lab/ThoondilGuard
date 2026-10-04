import {adminConnected} from '../lib/adminApi';
import { useUnsaved } from '../lib/useUnsaved';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../lib/workspaceState';
import type { Alert } from '../lib/workspaceState';
import { useLanguage } from '../lib/languageState';
import { Heading, Panel, Badge } from '../components/UI';
function now() { return new Date().toISOString(); }
function todayIST() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
function blank(): Alert { return { id: 'AL-' + crypto.randomUUID().slice(0, 8), title: '', english: '', tamil: '', area: '', nextStep: '', expires: '', support: [], state: 'Draft', updated: now() }; }
export function Alerts() {
    const { data } = useWorkspace();
    const { t } = useLanguage();
    const [params, setParams] = useSearchParams();
    const selected = data.alerts.find(a => a.id === params.get('draft'));
    const [tab, setTab] = useState('Draft');
    const [dirty, setDirty] = useState(false);
    function guard(action: () => void) {
        if (!dirty || confirm(t('Unsaved changes. Leave without saving?')))
            action();
    }
    const [newAlert, setNewAlert] = useState(blank);
    return <div className="space-y-6"><Heading title="Alerts"/><div className="flex flex-wrap gap-3">{['Draft', 'Published', 'Withdrawn'].map(s => <button key={s} className={tab === s ? 'primary' : 'secondary'} aria-pressed={tab === s} onClick={() => setTab(s)}>{t(s)}</button>)}<button className="secondary ml-auto" onClick={() => guard(() => { setParams({}); setNewAlert(blank()); })}>{t('New draft')}</button></div><div className="grid xl:grid-cols-[1fr_2fr] gap-6"><Panel>{data.alerts.filter(a => a.state === tab).map(a => <button key={a.id} className="block w-full text-left border-b border-border py-4" onClick={() => guard(() => setParams({ draft: a.id }))}><span className="font-semibold">{a.title || a.id}</span><span className="block mt-2"><Badge value={a.state}/></span></button>)}{!data.alerts.some(a => a.state === tab) && <p>{t('No alerts in this state')}</p>}</Panel><Editor key={selected?.id || newAlert.id} initial={selected || newAlert} onDirty={setDirty}/></div></div>;
}
function Editor({ initial, onDirty }: {
    initial: Alert;
    onDirty: (dirty: boolean) => void;
}) {
    const { data, saveAlert } = useWorkspace();
    const { t } = useLanguage();
    const [alert, setAlert] = useState(initial);
    const [baseline, setBaseline] = useState(JSON.stringify(initial));
    const [preview, setPreview] = useState(false);
    const [message, setMessage] = useState('');
    const dirty = JSON.stringify(alert) !== baseline;
    useUnsaved(dirty);
    useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
    const reviewed = data.reports.filter(r => r.decision === 'Suspicious');
    const locked = alert.state !== 'Draft';
    function change(key: keyof Alert, value: string) { setAlert({ ...alert, [key]: value }); setPreview(false); }
    async function save(state: Alert['state']) {
        setMessage('');
        if (state === 'Published') {
            const today = todayIST();
            if (!preview || ![alert.title, alert.english, alert.tamil, alert.area, alert.nextStep].every(v => v.trim()) || !alert.expires || alert.expires <= today || !alert.support.length || !alert.support.every(id => reviewed.some(r => r.id === id))) {
                setMessage(t('Complete both languages, title, area, next step, future expiry and reviewed evidence before publishing.'));
                return;
            }
            if (!confirm(t(adminConnected?'Publish this alert to the public portal?':'Publish this alert locally? Resident notifications are not connected.')))
                return;
        }
        if (state === 'Draft' && !alert.title.trim()) {
            setMessage(t('Title') + ' is required.');
            return;
        }
        try {
            const next = { ...alert, state, updated: now() };
            await saveAlert(next);
            setAlert(next);
            setBaseline(JSON.stringify(next));
            setMessage(t(adminConnected?'Saved to server.':'Saved in this browser session only.'));
        }
        catch {
            setMessage(t('Could not save. Your edits are still here.'));
        }
    }
    return <Panel title="Alerts"><Badge value={alert.state}/><div className="grid sm:grid-cols-2 gap-4 mt-4">{[['title', 'Title'], ['area', 'Area'], ['english', 'English guidance'], ['tamil', 'Tamil guidance'], ['nextStep', 'Safe next step'], ['expires', 'Expiry date']].map(([key, label]) => <label className={'field ' + (['english', 'tamil', 'nextStep'].includes(key) ? 'sm:col-span-2' : '')} key={key}>{t(label)}{['english', 'tamil', 'nextStep'].includes(key) ? <textarea aria-label={t(label)} lang={key === 'tamil' ? 'ta' : 'en'} disabled={locked} value={alert[key as 'english' | 'tamil' | 'nextStep']} onChange={e => change(key as keyof Alert, e.target.value)}/> : <input aria-label={t(label)} disabled={locked} type={key === 'expires' ? 'date' : 'text'} value={alert[key as 'title' | 'area' | 'expires']} onChange={e => change(key as keyof Alert, e.target.value)}/>}</label>)}</div><fieldset className="mt-5"><legend className="font-medium mb-3">{t('Supporting reviewed reports')}</legend>{reviewed.map(r => <label key={r.id} className="flex gap-3 items-center py-2"><input type="checkbox" disabled={locked} checked={alert.support.includes(r.id)} onChange={e => { setAlert({ ...alert, support: e.target.checked ? [...alert.support, r.id] : alert.support.filter(id => id !== r.id) }); setPreview(false); }}/>{r.id} · {r.area}</label>)}{!reviewed.length && <p className="text-sm text-text-secondary">{t('Inspect evidence and save a suspicious decision before drafting an alert.')}</p>}</fieldset><div className="mt-5 flex flex-wrap gap-3">{!locked && <button className="secondary" onClick={() => save('Draft')}>{t('Save draft')}</button>}<button className="secondary" onClick={() => setPreview(true)}>{t('Preview')}</button>{!locked && <button className="primary" disabled={!preview} onClick={() => save('Published')}>{t('Publish alert')}</button>}{alert.state === 'Published' && <button className="secondary" onClick={() => {
                if (confirm(t('Withdraw alert') + '?'))
                    save('Withdrawn');
            }}>{t('Withdraw alert')}</button>}</div>{message && <p role="status" className="mt-4 text-status-amber-text">{message}</p>}{preview && <section className="mt-6 rounded-xl border border-primary bg-nav-selected p-5"><h2 className="text-sm font-semibold text-primary">{t('Resident-visible preview')}</h2><h3 className="text-xl font-bold mt-3">{alert.title}</h3><p className="text-sm mt-2">{alert.area} · {alert.expires}</p><p className="whitespace-pre-wrap break-words mt-4" lang="en">{alert.english}</p><p className="whitespace-pre-wrap break-words mt-4" lang="ta">{alert.tamil}</p><p className="mt-4 font-medium">{alert.nextStep}</p><p className="mt-5 text-sm text-text-secondary">{t('Private notes and tracking keys are excluded.')}</p></section>}</Panel>;
}
