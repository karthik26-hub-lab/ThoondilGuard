import { redactPII } from './detector';

export interface Report {
  id: string;
  originalText: string;
  region: string;
  category: string;
  context?: string;
  timestamp: string;
  riskLevel: string;
  isSeed?: boolean;
}

const SEED_DATA: Report[] = [
  {
    id: 'seed-1',
    originalText: 'Dear customer, your EB Bill is pending. Update your KYC via http://update-eb-bill.com to avoid disconnection [PHONE REDACTED]',
    region: 'Velachery',
    category: 'Electricity Bill Scam',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    riskLevel: 'High concern',
    isSeed: true
  },
  {
    id: 'seed-2',
    originalText: 'Congratulations! You won ₹10,000 in lucky draw. Click bit.ly/win-prize to claim.',
    region: 'Adyar',
    category: 'Lottery/Prize',
    timestamp: new Date(Date.now() - 172800000).toISOString(),
    riskLevel: 'High concern',
    isSeed: true
  }
];

export function getReports(): Report[] {
  try {
    const data = localStorage.getItem('nammashield_reports');
    if (!data) return SEED_DATA;
    const parsed = JSON.parse(data);
    return [...parsed, ...SEED_DATA];
  } catch {
    return SEED_DATA;
  }
}

export function saveReport(report: Omit<Report, 'id' | 'timestamp' | 'isSeed'>): Report {
  const reports = getReports().filter(r => !r.isSeed);
  const newReport = {
    ...report,
    // Enforce redaction strictly at the storage boundary
    originalText: redactPII(report.originalText),
    id: `rep-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    timestamp: new Date().toISOString(),
    isSeed: false
  };
  reports.unshift(newReport);
  localStorage.setItem('nammashield_reports', JSON.stringify(reports));
  return newReport;
}
