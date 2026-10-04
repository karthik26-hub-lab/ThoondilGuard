import {adminConnected} from '../lib/adminApi';
import {ReviewAssistant} from '../components/ReviewAssistant';
import { useUnsaved } from '../lib/useUnsaved';
import { useState } from 'react';
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom';
import { useWorkspace, date } from '../lib/workspaceState';
import type { Report, Status, Decision } from '../lib/workspaceState';
import { useLanguage } from '../lib/languageState';
import { Heading, Panel, Badge } from '../components/UI';
export function ReportDetail() { const { id } = useParams(); const { data } = useWorkspace(); const { t } = useLanguage(); const report = data.reports.find(r => r.id === id); return report ? <Detail key={id} report={report}/> : <><Heading title="Report not found"/><Link to="/reports">{t('Back to reports')}</Link></>; }
function Detail({ report }: {
    report: Report;
}) {
    const { data, saveReport, saveAlert } = useWorkspace();
    const { t } = useLanguage();
    const location = useLocation();
    const navigate = useNavigate();
    const [status, setStatus] = useState<Status>(report.status);
    const [decision, setDecision] = useState<Decision>(report.decision);
    const [notes, setNotes] = useState(report.notes);
    const [message, setMessage] = useState('');
    const [saving, setSaving] = useState(false);
    const dirty = status !== report.status || decision !== report.decision || notes !== report.notes;
    useUnsaved(dirty);
    const related = data.reports.filter(r => r.id !== report.id && r.indicators.some(i => report.indicators.includes(i)));
    async function save() {
        setMessage('');
        if ((status !== report.status || decision !== report.decision) && (!notes.trim() || notes.trim() === report.notes.trim())) {
            setMessage(t('Add a reason before changing the decision or workflow.'));
            return;
        }
        setSaving(true);
        try {
            await saveReport(report.id, status, decision, notes.trim());
            setNotes(notes.trim());
            setMessage(t(adminConnected?'Saved to server.':'Saved in this browser session only.'));
        }
        catch (error) {
            setMessage(error instanceof Error?error.message:t('Could not save. Your edits are still here.'));
        }
        finally {
            setSaving(false);
        }
    }
    async function draft() {
        try {
            const id = 'AL-' + crypto.randomUUID().slice(0, 8);
            await saveAlert({ id, title: '', english: '', tamil: '', area: report.area, nextStep: '', expires: '', support: [report.id], state: 'Draft', updated: new Date().toISOString() });
            navigate('/alerts?draft=' + id);
        }
        catch (error) {
            setMessage(error instanceof Error?error.message:t('Could not save. Your edits are still here.'));
        }
    }
    return <div className="space-y-6"><Link to={'/reports' + location.search} className="text-primary underline inline-flex min-h-11 items-center">← {t('Back to reports')}</Link><Heading title={t('Reports') + ' · ' + report.id} description={date(report.submitted)}/><div className="grid xl:grid-cols-[3fr_2fr] gap-6"><div className="space-y-6"><Panel title="Masked evidence"><p className="rounded-lg bg-panel-alt p-4 whitespace-pre-wrap break-words" lang={report.language === 'Tamil' ? 'ta' : 'en'}>{report.text}</p><dl className="grid sm:grid-cols-3 gap-4 mt-4">{[['Area', report.area], ['Language', t(report.language)], ['Channel', report.channel]].map(([k, v]) => <div key={k}><dt className="text-sm text-text-secondary">{t(k)}</dt><dd className="mt-1 font-medium">{v}</dd></div>)}</dl></Panel><ReviewAssistant report={report} reports={data.reports} onDraft={value=>setNotes(previous=>previous?previous+'\n\n'+value:value)}/><Panel title="Automated assessment"><Badge value={report.concern}/><p className="text-sm text-text-secondary mt-3">{t('Synthetic example; not a live model result.')}</p><ul className="list-disc pl-5 mt-4 space-y-2">{report.findings.map(f => <li key={f}>{t(f)}</li>)}</ul></Panel><Panel title="Indicators">{report.indicators.map(i => <div key={i} className="flex flex-wrap justify-between gap-2 border-b border-border py-3"><code className="break-all">{i}</code><Link to={'/campaigns?q=' + encodeURIComponent(i)} className="text-primary underline">{t('Find related')}</Link></div>)}{!report.indicators.length && <p>{t('No shared indicator supplied')}</p>}</Panel></div><div className="space-y-6"><Panel title="Submission checks"><p>{t(report.contactVerified === true ? "Contact verified" : report.contactVerified === false ? "Contact not verified" : "Verification status unavailable")}</p><p className="mt-3 text-sm text-text-secondary">{t(report.submissionFlag || "No submission flag supplied")}</p><p className="mt-3 text-sm text-text-secondary">{t("Verified contact does not establish that a report is truthful.")}</p></Panel><Panel title="Administrator decision"><label className="field">{t('Status')}<select aria-label={t('Status')} value={status} onChange={e => setStatus(e.target.value as Status)}>{['New', 'In progress', 'Closed'].map(s => <option value={s} key={s}>{t(s)}</option>)}</select></label><label className="field mt-4">{t('Decision')}<select aria-label={t('Decision')} value={decision} onChange={e => setDecision(e.target.value as Decision)}>{['Pending', 'Suspicious', 'Insufficient evidence', 'No concern identified'].map(s => <option key={s} value={s}>{t(s)}</option>)}</select></label><label className="field mt-4">{t('Private notes / rationale')}<textarea aria-label={t('Private notes / rationale')} value={notes} onChange={e => setNotes(e.target.value)} className="min-h-32"/></label><button onClick={save} disabled={!dirty || saving} className="primary mt-5">{t(saving ? 'Saving…' : 'Save decision')}</button>{message && <p role="status" className="mt-3 text-sm">{message}</p>}<div className="border-t border-border mt-5 pt-5"><button disabled={dirty || report.decision !== 'Suspicious'} onClick={draft} className="secondary">{t('Create alert draft')}</button><p className="text-sm text-text-secondary mt-2">{t('Inspect evidence and save a suspicious decision before drafting an alert.')}</p></div></Panel><Panel title="Related reports"><p className="text-sm text-text-secondary mb-3">{t('Matching indicators suggest a relationship, not proof of a campaign.')}</p>{related.map(r => <Link key={r.id} to={'/reports/' + r.id} className="block border-b border-border py-3 text-primary underline">{r.id} · {r.area}</Link>)}{!related.length && <p>{t('No candidate groups')}</p>}</Panel><Panel title="Activity history">{data.events.filter(e => e.target === report.id).map(e => <div key={e.id} className="border-b border-border py-3"><p>{t(e.action)}</p><p className="text-sm text-text-secondary">{date(e.time)} · {t('Administrator')}</p><p className="mt-2 whitespace-pre-wrap break-words">{e.note}</p></div>)}{!data.events.some(e => e.target === report.id) && <p>{t('No events for this report')}</p>}</Panel></div></div></div>;
}
