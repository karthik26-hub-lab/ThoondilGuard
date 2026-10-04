import type { AnalysisProviderResult, AnalysisSignal } from '../../../types/analysis.js';
import type { AnalysisInput } from '../../../types/analysis.js';
import { UrlAnalysisService } from '../UrlAnalysisService.js';
import type { AnalysisProvider } from './AnalysisProvider.js';

const DOMAIN_SIGNAL_TYPES = new Set([
  'ip_address_host', 'excessive_subdomains', 'brand_like_domain', 'punycode_hostname', 'unicode_hostname',
]);

export class UrlAnalysisProvider implements AnalysisProvider {
  readonly name = 'url-analysis';

  constructor(private readonly service = new UrlAnalysisService()) {}

  analyze(input: AnalysisInput): AnalysisProviderResult {
    const text = [input.content, input.extractedText, input.url]
      .filter((value): value is string => Boolean(value?.trim()))
      .join('\n');
    const urls = this.service.extract(text);
    const signals: AnalysisSignal[] = urls.flatMap((url) => url.signals.map((item) => ({
      reason: {
        category: DOMAIN_SIGNAL_TYPES.has(item.type) ? 'suspicious_domain' : 'suspicious_link',
        message: item.description,
        severity: item.severity,
        source: 'url',
      },
      evidence: [{
        type: 'url_pattern',
        description: `${item.type}: ${item.description}`,
        source: 'url',
      }],
    })));
    const indicators = urls.flatMap((url) => [
      { type: 'URL' as const, value: url.normalizedUrl, source: 'url' as const },
      { type: 'DOMAIN' as const, value: url.domain, source: 'url' as const },
    ]);

    return { signals, indicators, urls };
  }
}
