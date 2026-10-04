import type { ReactNode } from 'react';
import { useLanguage } from '../lib/languageState';
export function Heading({ title, description }: {
    title: string;
    description?: string;
}) { const { t } = useLanguage(); return <div className="page-heading mb-7"><h1 className="text-[30px] font-semibold leading-tight">{t(title)}</h1>{description && <p className="mt-3 text-sm text-text-secondary">{t(description)}</p>}</div>; }
export function Panel({ title, children }: {
    title?: string;
    children: ReactNode;
}) { const { t } = useLanguage(); return <section className="admin-panel bg-panel rounded-xl border border-border p-5 lg:p-6">{title && <h2 className="text-base font-semibold mb-5">{t(title)}</h2>}{children}</section>; }
export function Badge({ value }: {
    value: string;
}) { const { t } = useLanguage(); const color = ['High concern', 'Suspicious'].includes(value) ? 'bg-status-red-bg text-status-red-text' : ['Closed', 'Published', 'Confirmed', 'No concern identified'].includes(value) ? 'bg-status-green-bg text-status-green-text' : 'bg-status-amber-bg text-status-amber-text'; return <span className={'inline-block rounded-md px-2.5 py-1 text-xs font-medium ' + color}>{t(value)}</span>; }
