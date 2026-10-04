import { isIP } from 'node:net';
import { domainToUnicode } from 'node:url';
import { parse as parseDomain } from 'tldts';

export type UrlSignalSeverity = 'low' | 'medium' | 'high';

export interface UrlSignal {
  type: string;
  description: string;
  severity: UrlSignalSeverity;
}

export interface UrlQueryParameter {
  name: string;
  value?: string;
}

export interface UrlAnalysis {
  url: string;
  normalizedUrl: string;
  scheme: string;
  hostname: string;
  domain: string;
  subdomain: string | null;
  port: number | null;
  path: string;
  queryParameters: UrlQueryParameter[];
  signals: UrlSignal[];
}

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"'`]+|(?<![@\w])(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+(?:[a-z\p{L}]{2,63}|xn--[a-z\p{N}-]{2,})\b(?::\d{1,5})?(?:\/[^\s<>"'`]*)?/giu;
const TRAILING_PUNCTUATION = /[.,!?;:)}\]]+$/u;
const SHORTENER_DOMAINS = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'cutt.ly',
  'shorturl.at', 'rb.gy', 'rebrand.ly', 'buff.ly', 'tiny.cc', 'lnkd.in',
]);
const BRANDS: Record<string, string> = {
  amazon: 'amazon.com', apple: 'apple.com', facebook: 'facebook.com',
  google: 'google.com', instagram: 'instagram.com', microsoft: 'microsoft.com',
  netflix: 'netflix.com', paypal: 'paypal.com', whatsapp: 'whatsapp.com',
};
const SUSPICIOUS_WORDS = /(?:login|signin|verify|verification|secure|account|update|wallet|password|otp|claim|reward|refund|kyc|support|billing|unlock)/iu;
const REDIRECT_PARAMETER = /^(?:url|uri|redirect|redirect_url|next|destination|dest|target|continue|return|return_url|forward|goto)$/iu;
const SECRET_PARAMETER = /(?:token|session|auth|code|email|phone|mobile|otp|key|password|user|account|id)/iu;

function trimCandidate(candidate: string): string {
  return candidate.replace(TRAILING_PUNCTUATION, '');
}

function extractCandidates(text: string): string[] {
  const matches = text.match(URL_PATTERN) ?? [];
  return [...new Set(matches.map(trimCandidate).filter((candidate) => Boolean(candidate) && candidate.length <= 2_048))].slice(0, 50);
}

function parseCandidate(candidate: string): URL | null {
  const suppliedScheme = /^[a-z][a-z\d+.-]*:\/\//iu.test(candidate);
  try {
    return new URL(suppliedScheme ? candidate : `http://${candidate}`);
  } catch {
    return null;
  }
}

function exposedQueryParameters(url: URL): UrlQueryParameter[] {
  return [...url.searchParams.entries()].slice(0, 20).map(([name, value]) => ({
    name: name.slice(0, 100),
    ...(SECRET_PARAMETER.test(name) ? {} : { value: value.slice(0, 160) }),
  }));
}

function redactSensitiveUrlParts(url: URL): URL {
  const sanitized = new URL(url.toString());
  sanitized.hash = '';
  sanitized.username = '';
  sanitized.password = '';
  const entries = [...sanitized.searchParams.entries()];
  sanitized.search = '';
  for (const [name, value] of entries) {
    sanitized.searchParams.append(name, SECRET_PARAMETER.test(name) ? '[redacted]' : value);
  }
  return sanitized;
}

function analyzeSignals(candidate: string, url: URL, hostname: string, domain: string, subdomain: string | null): UrlSignal[] {
  const signals: UrlSignal[] = [];
  const add = (type: string, description: string, severity: UrlSignalSeverity = 'low'): void => {
    signals.push({ type, description, severity });
  };
  const hostForEvidence = hostname.slice(0, 253);

  if (url.protocol === 'http:') add('http_scheme', 'The URL uses HTTP without transport encryption.', 'low');
  if (isIP(hostname)) add('ip_address_host', 'The URL uses a raw IP address instead of a domain name.', 'medium');
  if (SHORTENER_DOMAINS.has(domain)) add('known_shortener', 'The host is a commonly used URL-shortening domain; the destination is not inspected.', 'low');
  if (subdomain && subdomain.split('.').length >= 3) {
    add('excessive_subdomains', `The host contains several subdomain labels (${hostForEvidence}).`, 'low');
  }
  if (SUSPICIOUS_WORDS.test(hostname)) {
    add('suspicious_hostname_terms', 'The hostname contains account, verification, reward, or similar action-related terms.', 'low');
  }
  const domainWithoutSuffix = parseDomain(hostname).domainWithoutSuffix?.toLowerCase();
  if (domainWithoutSuffix) {
    for (const [brand, officialDomain] of Object.entries(BRANDS)) {
      if (domainWithoutSuffix.includes(brand) && domain !== officialDomain) {
        add('brand_like_domain', `The registrable domain contains the brand-like term “${brand}” but is not its common primary domain (${domain}).`, 'medium');
        break;
      }
    }
  }
  if (url.port && !((url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443'))) {
    add('unusual_port', `The URL specifies a non-default port (${url.port}).`, 'low');
  }
  if (url.username || url.password) add('userinfo_obfuscation', 'The URL includes user-info before the hostname, which can obscure the displayed destination.', 'medium');
  if (/%[0-9a-f]{2}/iu.test(candidate)) add('percent_encoding', 'The URL contains percent-encoded characters; this is not inherently malicious.', 'low');
  if (hostname.startsWith('xn--') || hostname.includes('.xn--')) {
    add('punycode_hostname', `The hostname uses an IDN punycode label (${domainToUnicode(hostname) || hostname}).`, 'low');
  } else if (/[\u0080-\uFFFF]/u.test(hostname)) {
    add('unicode_hostname', 'The hostname contains Unicode characters; visually similar characters may be difficult to distinguish.', 'low');
  }
  if (SUSPICIOUS_WORDS.test(url.pathname)) add('suspicious_path', 'The URL path contains an action-related term; the page was not opened.', 'low');
  for (const [name, value] of url.searchParams.entries()) {
    let decodedValue = value;
    try { decodedValue = decodeURIComponent(value); } catch { /* Keep the original malformed encoded value. */ }
    if (REDIRECT_PARAMETER.test(name) && /(?:https?:\/\/|^\/\/)/iu.test(decodedValue)) {
      add('redirect_parameter', `Query parameter “${name.slice(0, 80)}” appears to carry a redirect destination.`, 'low');
      break;
    }
  }
  return signals;
}

export class UrlAnalysisService {
  extract(text: string): UrlAnalysis[] {
    return extractCandidates(text).flatMap((candidate) => {
      const parsed = parseCandidate(candidate);
      if (!parsed || !['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) return [];

      const hostname = parsed.hostname.toLowerCase().replace(/\.$/u, '');
      const parsedDomain = parseDomain(hostname);
      const domain = parsedDomain.domain?.toLowerCase() ?? hostname;
      const subdomain = parsedDomain.subdomain?.toLowerCase() || null;
      const normalized = redactSensitiveUrlParts(parsed);

      return [{
        url: normalized.toString(),
        normalizedUrl: normalized.toString(),
        scheme: parsed.protocol.slice(0, -1),
        hostname,
        domain,
        subdomain,
        port: parsed.port ? Number(parsed.port) : null,
        path: parsed.pathname,
        queryParameters: exposedQueryParameters(parsed),
        signals: analyzeSignals(candidate, parsed, hostname, domain, subdomain),
      }];
    });
  }
}
