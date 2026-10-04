import {adminConnected} from '../lib/adminApi';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useWorkspace, groupsOf, date } from '../lib/workspaceState';
import { useLanguage } from '../lib/languageState';
import { Heading, Panel, Badge } from '../components/UI';
export function ThreatIntel() { const { data } = useWorkspace(); const { t } = useLanguage(); return <div className="space-y-6"><Heading title="Threat intelligence" description="Submission counts are not estimates of scam prevalence."/><div className="grid lg:grid-cols-2 gap-6">{[['Area', data.reports.map(r => r.area)], ['Language', data.reports.map(r => r.language)], ['Channel', data.reports.map(r => r.channel)], ['Concern', data.reports.map(r => r.concern)]].map(([label, values]) => <Panel key={String(label)} title={String(label)}><dl className="space-y-3">{[...new Set(values as string[])].map(value => <div key={value} className="flex justify-between border-b border-border pb-3"><dt>{t(value)}</dt><dd className="font-bold">{(values as string[]).filter(v => v === value).length}</dd></div>)}</dl></Panel>)}</div><Link to="/campaigns" className="primary inline-flex">{t('Related reports')}</Link></div>; }
export function Campaigns() {
    const { data, decideGroup } = useWorkspace();
    const { t } = useLanguage();
    const [params] = useSearchParams();
    const [reason, setReason] = useState<Record<string, string>>({});
    const [message, setMessage] = useState('');
    const groups = groupsOf(data.reports).filter(([i]) => i.includes(params.get('q') || ''));
    async function decide(indicator: string, decision: string) {
        if (!reason[indicator]?.trim()) {
            setMessage(t('Add a reason before changing the decision or workflow.'));
            return;
        }
        try {
            await decideGroup(indicator, decision, reason[indicator].trim());
            setMessage(t(adminConnected?'Saved to server.':'Saved in this browser session only.'));
        }
        catch {
            setMessage(t('Could not save. Your edits are still here.'));
        }
    }
    return <div className="space-y-6"><Heading title="Related reports" description="Matching indicators suggest a relationship, not proof of a campaign."/>{message && <p role="status">{message}</p>}{groups.map(([i, rows]) => <Panel key={i}><div className="flex flex-wrap justify-between gap-3"><h2 className="font-bold break-all">{i}</h2><Badge value={data.groups[i]?.decision || 'Unreviewed'}/></div><div className="mt-4 flex flex-wrap gap-3">{rows.map(r => <Link to={'/reports/' + r.id} key={r.id} className="secondary">{r.id} · {r.area}</Link>)}</div><p className="mt-4 text-sm text-text-secondary">{t('Indicators')}: {i} · {rows.length} {t('Reports')}</p><label className="field mt-4">{t('Reason')}<textarea aria-label={t('Reason')} value={reason[i] ?? data.groups[i]?.note ?? ''} onChange={e => setReason({ ...reason, [i]: e.target.value })}/></label><div className="flex flex-wrap gap-3 mt-4"><button onClick={() => decide(i, 'Confirmed')} className="primary">{t('Confirm relationship')}</button><button onClick={() => decide(i, 'Rejected')} className="secondary">{t('Reject relationship')}</button></div></Panel>)}{!groups.length && <Panel><p>{t('No candidate groups')}</p></Panel>}</div>;
}
export function AuditHistory() { const { data } = useWorkspace(); const { t } = useLanguage(); return <><Heading title="Activity history" description="Local activity history. Server audit logging is not connected."/><Panel>{data.events.map(e => <article key={e.id} className="border-b border-border py-4"><div className="flex flex-wrap justify-between gap-3"><h2 className="font-semibold">{t(e.action)} · {e.target}</h2><p className="text-sm text-text-secondary">{date(e.time)}</p></div><p className="mt-2 break-words whitespace-pre-wrap">{e.note}</p><p className="text-sm text-text-secondary mt-2">{t('Administrator')} · {t('Sample records')}</p></article>)}{!data.events.length && <p>{t('No activity yet')}</p>}</Panel></>; }
export function Settings() {
    const { reset } = useWorkspace();
    const { t } = useLanguage();
    const [message, setMessage] = useState('');
    return <div className="space-y-6"><Heading title="Settings"/><Panel title="Connection status"><Badge value={adminConnected?"Server API configured":"Backend not connected"}/><p className="mt-4">{t('Live authentication and server authorisation are required before using real reports.')}</p></Panel><section id="accessibility"><Panel title="Help & accessibility"><p>{t('Keyboard access, clear focus, text-labelled states and responsive layouts are provided. Compliance certification has not been assessed.')}</p></Panel></section><Panel title="Sample records"><button className="secondary" onClick={() => {
            if (confirm(t('Reset all local decisions, alerts and activity?'))) {
                try {
                    reset();
                    setMessage(t(adminConnected?'Saved to server.':'Saved in this browser session only.'));
                }
                catch {
                    setMessage(t('Could not save. Your edits are still here.'));
                }
            }
        }}>{t('Reset sample records')}</button>{message && <p role="status" className="mt-3">{message}</p>}</Panel></div>;
}
export function Extensions() { const { t } = useLanguage(); return <div className="space-y-6"><Heading title="Extensions"/><Panel title="Browser extension"><Badge value="Developer build"/><dl className="mt-5 grid sm:grid-cols-2 gap-5"><div><dt className="text-sm text-text-secondary">{t('Connection status')}</dt><dd className="mt-1">{t('Backend not connected')}</dd></div><div><dt className="text-sm text-text-secondary">{t('Status')}</dt><dd className="mt-1">{t('No live extension telemetry')}</dd></div></dl><p className="mt-5 text-text-secondary">Manual page capture → portal OCR review → analysis → resident report. Admin receives extension-origin reports through the same future report API. Device permissions and scans remain controlled by the resident.</p></Panel></div>; }
