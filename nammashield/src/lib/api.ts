import { detectFraud } from './detector';
import type { DetectionResult } from './detector';
import type { Language } from './i18n';
const baseUrl = (import.meta.env.VITE_BACKEND_URL ?? '').trim().replace(/\/+$/, '');
export const hasBackend = Boolean(baseUrl);
export async function analyzeMessage(text: string, language: Language): Promise<DetectionResult> {
  if (!baseUrl) return detectFraud(text);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(`${baseUrl}/analyze`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language }), signal: controller.signal,
      cache: 'no-store', credentials: 'omit',
    });
    if (!response.ok) throw new Error('Analysis unavailable');
    const result: unknown = await response.json();
    if (!result || typeof result !== 'object') throw new Error('Invalid response');
    const value = result as Record<string, unknown>;
    if (!['High concern', 'Needs verification', 'No strong warning signs found'].includes(String(value.riskLevel)) ||
      !Array.isArray(value.findings) || !value.findings.every(item => typeof item === 'string') ||
      !Array.isArray(value.actions) || !value.actions.every(item => typeof item === 'string')) throw new Error('Invalid response');
    return value as unknown as DetectionResult;
  } finally { clearTimeout(timeout); }
}
