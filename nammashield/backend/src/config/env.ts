import 'dotenv/config';

function parsePort(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return 5000;

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return port;
}

function parseClientOrigins(value: string | undefined): string[] {
  return (value ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
      try {
        return new URL(origin).origin;
      } catch {
        throw new Error('CLIENT_ORIGIN must contain valid origins.');
      }
    });
}

function parseTrustedProxies(value: string | undefined): false | string[] {
  if (!value?.trim()) return false;
  const entries = value.split(',').map(x => x.trim());
  if (entries.some(x => !x || ['true', '*', '0.0.0.0/0', '::/0'].includes(x) || /^\d+$/.test(x))) {
    throw new Error('TRUSTED_PROXY_CIDRS must list specific proxy IP addresses or CIDRs; blanket trust and hop counts are not permitted.');
  }
  return entries;
}

export const env = {
  port: parsePort(process.env.PORT),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  trustedProxies: parseTrustedProxies(process.env.TRUSTED_PROXY_CIDRS),
  clientOrigins: parseClientOrigins(process.env.CLIENT_ORIGIN),
  adminOrigins: parseClientOrigins(process.env.ADMIN_ORIGIN ?? 'http://localhost:4190,http://127.0.0.1:4190'),
  mongodbUri: process.env.MONGODB_URI,
  mongodbDatabase: process.env.MONGODB_DATABASE?.trim() || 'thoondilguard',
  geminiModel: process.env.GEMINI_MODEL?.trim(),
  geminiApiKey: process.env.GEMINI_API_KEY?.trim(),
  internalThreatIntelligenceToken: process.env.INTERNAL_THREAT_INTELLIGENCE_TOKEN?.trim(),
  tesseractLangPath: process.env.TESSERACT_LANG_PATH?.trim(),
  dnsServers: (process.env.DNS_SERVERS ?? '')
    .split(',')
    .map((server) => server.trim())
    .filter(Boolean),
} as const;

export const isProduction = env.nodeEnv === 'production';
