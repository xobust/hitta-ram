// Minimal Cloudflare types to avoid bringing workers-types globally
type CF_KVNamespace = { get: (key: string, opts?: { type?: 'text' | 'json' | 'arrayBuffer' }) => Promise<any>; put: (key: string, value: string, opts?: { expirationTtl?: number }) => Promise<void> };
interface Env { CACHE?: CF_KVNamespace; PRISJAKT_API_KEY?: string }

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return new Response('ok', { status: 200 });
    }

    if (url.pathname === '/api/prices' && request.method === 'POST') {
      try {
        const body = (await request.json()) as { moduleNumber?: string };
        const moduleNumber = body.moduleNumber?.trim();
        if (!moduleNumber) return json({ error: 'moduleNumber required' }, 400);

        const cacheKey = `ram_${moduleNumber}`;

        // Try KV cache first
        if (env.CACHE) {
          const cached = await env.CACHE.get(cacheKey, { type: 'json' });
          if (cached) return json({ products: cached, cached: true }, 200);
        }

        // Call upstream (placeholder; wire to Prisjakt in future)
        const products = [{ id: 'mock', name: `${moduleNumber}`, price: 999, currency: 'SEK', store: 'Mock', storeUrl: 'https://example.com', availability: true }];

        if (env.CACHE) {
          await env.CACHE.put(cacheKey, JSON.stringify(products), { expirationTtl: 3600 });
        }

        return json({ products }, 200);
      } catch (e: any) {
        return json({ error: e?.message || 'Unknown error' }, 500);
      }
    }

    return new Response('Not found', { status: 404 });
  },
} as { fetch: (req: Request, env: Env) => Promise<Response> };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}


