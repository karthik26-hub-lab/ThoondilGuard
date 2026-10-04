import { Link, useSearchParams } from 'react-router-dom';
import { useWorkspace, date } from '../lib/workspaceState';
import { useLanguage } from '../lib/languageState';
import { Heading, Badge } from '../components/UI';
export function Reports() {
    const { data } = useWorkspace();
    const { t } = useLanguage();
    const [params, setParams] = useSearchParams();
    function set(key: string, value: string) {
        const next = new URLSearchParams(params);
        if (value)
            next.set(key, value);
        else
            next.delete(key);
        setParams(next, { replace: true });
    }
    const q = (params.get('q') || '').toLowerCase();
    const rows = data.reports.filter(r => [r.id, r.text, r.area, ...r.indicators].join(' ').toLowerCase().includes(q) && ['status', 'concern', 'language', 'channel', 'area'].every(k => !params.get(k) || r[k as 'status' | 'concern' | 'language' | 'channel' | 'area'] === params.get(k)) && (!params.get('from') || r.submitted.slice(0, 10) >= params.get('from')!) && (!params.get('to') || r.submitted.slice(0, 10) <= params.get('to')!));
    const filters = [['status', 'Status', ['New', 'In progress', 'Closed']], ['concern', 'Concern', ['High concern', 'Needs verification', 'No strong warning signs found']], ['language', 'Language', ['English', 'Tamil', 'Tanglish']], ['channel', 'Channel', [...new Set(data.reports.map(r => r.channel))]], ['area', 'Area', [...new Set(data.reports.map(r => r.area))]]] as const;
    return <><Heading title="Reports"/><div className="reports-panel bg-panel rounded-xl border border-border"><div className="reports-filters p-5 grid sm:grid-cols-2 xl:grid-cols-4 gap-4"><label className="field sm:col-span-2">{t('Search reports')}<input aria-label={t('Search reports')} value={params.get('q') || ''} onChange={e => set('q', e.target.value)}/></label>{filters.map(([key, label, options]) => <label key={key} className="field">{t(label)}<select aria-label={t(label)} value={params.get(key) || ''} onChange={e => set(key, e.target.value)}><option value="">{t('All')}</option>{options.map(o => <option key={o} value={o}>{t(o)}</option>)}</select></label>)}{[['from', 'From date'], ['to', 'To date']].map(([key, label]) => <label key={key} className="field">{t(label)}<input aria-label={t(label)} type="date" value={params.get(key) || ''} onChange={e => set(key, e.target.value)}/></label>)}<button onClick={() => setParams({})} className="secondary self-end">{t('Reset filters')}</button></div><div className="overflow-x-auto"><table className="reports-table w-full text-left text-sm table-fixed min-w-[1300px]"><caption className="sr-only">{t('Reports')} · {rows.length}</caption><colgroup>{[12,13,22,9,9,9,11,8,7].map((width,i)=><col key={i} style={{width:width+'%'}}/>)}</colgroup><thead className="bg-panel-alt"><tr>{['Reference', 'Submitted', 'Message preview', 'Area', 'Language', 'Channel', 'Concern', 'Status', 'Action'].map(h => <th key={h} scope="col" className="p-4">{t(h)}</th>)}</tr></thead><tbody>{rows.map(r => <tr key={r.id} className="border-t border-border hover:bg-panel-alt/60"><th scope="row" className="p-4 break-all font-mono text-[11px] font-normal text-stone-600">{r.id}</th><td className="p-4">{date(r.submitted)}</td><td className="p-4"><p className="line-clamp-3">{r.text}</p></td><td className="p-4">{r.area}</td><td className="p-4">{t(r.language)}</td><td className="p-4">{r.channel}</td><td className="p-4"><Badge value={r.concern}/></td><td className="p-4">{t(r.status)}</td><td className="p-4"><Link to={'/reports/' + r.id + '?' + params.toString()} className="secondary">{t('Open report')}</Link></td></tr>)}</tbody></table></div>{!rows.length && <p role="status" className="p-6">{t('No matching reports')}</p>}<p role="status" className="p-4 border-t border-border text-sm text-text-secondary">{rows.length} / {data.reports.length} · {t('Sample records')}</p></div></>;
}
