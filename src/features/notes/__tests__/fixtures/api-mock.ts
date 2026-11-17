import { vi } from 'vitest';

export function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

export interface RecordedCall {
  method: string;
  path: string;
  body: unknown;
}

type Handler = (call: RecordedCall) => Response | Promise<Response>;

/**
 * Stubs `fetch` with a tiny router. Keys are `"METHOD /path"` relative to
 * `/api/v1` (query string ignored). Unmatched GETs answer with an empty list
 * so unrelated pickers on the page stay quiet; unmatched writes throw.
 */
export function mockApi(routes: Record<string, Handler>) {
  const calls: RecordedCall[] = [];
  const fn = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'http://localhost');
    const method = (init.method ?? 'GET').toUpperCase();
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const call: RecordedCall = {
      method,
      path,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);

    if (method === 'GET' && path === '/auth/csrf') return json({ data: { csrf_token: 'tok' } });
    const handler = routes[`${method} ${path}`];
    if (handler) return handler(call);
    if (method === 'GET') {
      return json({ data: [], meta: { page: 1, per_page: 25, total: 0, total_pages: 0 } });
    }
    throw new Error(`Unexpected ${method} ${path}`);
  });
  vi.stubGlobal('fetch', fn);
  return {
    calls,
    /** Calls matching `"METHOD /path"`. */
    to: (key: string) => calls.filter((call) => `${call.method} ${call.path}` === key),
  };
}
