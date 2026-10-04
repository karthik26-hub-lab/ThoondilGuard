import { createContext, useContext } from 'react';
export type Status = 'New' | 'In progress' | 'Closed';
export type Decision = 'Pending' | 'Suspicious' | 'Insufficient evidence' | 'No concern identified';
export type Report = {
    id: string;
    submitted: string;
    text: string;
    area: string;
    language: string;
    channel: string;
    concern: string;
    status: Status;
    decision: Decision;
    notes: string;
    indicators: string[];
    findings: string[];
    version?: number;
    contactVerified?: boolean;
    submissionFlag?: string;
};
export type Alert = {
    id: string;
    title: string;
    english: string;
    tamil: string;
    area: string;
    nextStep: string;
    expires: string;
    support: string[];
    state: 'Draft' | 'Published' | 'Withdrawn';
    updated: string;
    version?: number;
};
export type Event = {
    id: string;
    time: string;
    action: string;
    target: string;
    note: string;
};
const fixtures: Report[] = [
    { id: 'TG801', submitted: '2026-10-03T10:45:00+05:30', text: 'Your electricity bill is overdue. Pay immediately through eb-update.example or power will be disconnected tonight. [PHONE REDACTED]', area: 'Velachery', language: 'English', channel: 'WhatsApp', concern: 'High concern', status: 'New', decision: 'Pending', notes: '', indicators: ['eb-update.example'], findings: ['Pressure to act quickly', 'Payment through an unverified website'] },
    { id: 'TG802', submitted: '2026-10-03T09:12:00+05:30', text: 'Dear customer, share your bank password to prevent your account being blocked. [EMAIL REDACTED]', area: 'Adyar', language: 'English', channel: 'Portal', concern: 'High concern', status: 'In progress', decision: 'Pending', notes: '', indicators: [], findings: ['Request for a password', 'Threat of account restriction'] },
    { id: 'TG803', submitted: '2026-10-02T16:30:00+05:30', text: 'நீங்கள் ஒரு பரிசை வென்றுள்ளீர்கள். பெறுவதற்கு முன்கட்டணம் செலுத்துங்கள்.', area: 'Thiruvanmiyur', language: 'Tamil', channel: 'WhatsApp', concern: 'Needs verification', status: 'New', decision: 'Pending', notes: '', indicators: [], findings: ['Upfront payment to claim a prize'] },
    { id: 'TG804', submitted: '2026-10-02T14:20:00+05:30', text: 'Avoid electricity disconnection. Update your billing details at eb-update.example today.', area: 'Adyar', language: 'Tanglish', channel: 'Extension', concern: 'Needs verification', status: 'In progress', decision: 'Pending', notes: '', indicators: ['eb-update.example'], findings: ['Shared unverified domain', 'Disconnection threat'] },
    { id: 'TG805', submitted: '2026-10-01T11:05:00+05:30', text: 'Your requested sign-in OTP expires in five minutes. Do not share it with anyone. [NUMBER REDACTED]', area: 'Besant Nagar', language: 'English', channel: 'PWA', concern: 'No strong warning signs found', status: 'Closed', decision: 'No concern identified', notes: 'Illustrative legitimate sign-in notification; no password request or payment link.', indicators: [], findings: ['No strong warning signs in this example'] }
];
export const empty = { reports: fixtures, alerts: [] as Alert[], events: [] as Event[], groups: {} as Record<string, {
        decision: string;
        note: string;
    }> };
export type Data = typeof empty;
export function load(): Data {
    try {
        const raw = sessionStorage.getItem('thg-admin-demo-v1');
        if (raw) {
            const x = JSON.parse(raw);
            if (Array.isArray(x.reports) && Array.isArray(x.alerts) && Array.isArray(x.events) && x.groups)
                return x;
        }
    }
    catch { }
    return empty;
}
export const Context = createContext<null | {
    data: Data;
    saveReport: (id: string, status: Status, decision: Decision, notes: string) => Promise<void>;
    saveAlert: (alert: Alert) => Promise<void>;
    decideGroup: (indicator: string, decision: string, note: string) => Promise<void>;
    reset: () => void;
    refresh: () => Promise<void>;
    loading: boolean;
    error: string;
}>(null);
export function useWorkspace() {
    const c = useContext(Context);
    if (!c)
        throw Error('Workspace provider missing');
    return c;
}
export function groupsOf(reports: Report[]) {
    const map = new Map<string, Report[]>();
    for (const report of reports)
        for (const indicator of report.indicators) {
            const list = map.get(indicator) || [];
            list.push(report);
            map.set(indicator, list);
        }
    return [...map].filter(([, rows]) => rows.length > 1);
}
export function date(value: string) { return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(value)) + ' IST'; }
