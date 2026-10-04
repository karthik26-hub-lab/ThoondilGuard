export const config = { runtime: 'edge' };

export default async function handler(req) {
  const targetBaseUrl = process.env.RENDER_API_URL;
  if (!targetBaseUrl) return new Response('Missing RENDER_API_URL env var', { status: 500 });
  
  const url = new URL(req.url);
  const base = targetBaseUrl.replace(/\/$/, '');
  const targetUrl = new URL(url.pathname + url.search, base);
  
  const headers = new Headers(req.headers);
  headers.delete('host');
  
  return fetch(targetUrl, {
    method: req.method,
    headers: headers,
    body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
    redirect: 'manual'
  });
}
