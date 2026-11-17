/**
 * Route-based `fetch` stub for component tests. Routes are keyed by
 * `"METHOD /path"` relative to `/api/v1` (query string ignored); every call is
 * recorded so tests can assert on what was sent.
 */
import { vi } from 'vitest';

export function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

export const data = (value: unknown, init: ResponseInit = {}) => json({ data: value }, init);

export const list = (items: unknown[]) =>
  json({ data: items, meta: { page: 1, per_page: 25, total: items.length, total_pages: items.length ? 1 : 0 } });

export const apiError = (status: number, code: string, message: string, details?: Record<string, string[]>) =>
  json({ error: { code, message, ...(details ? { details } : {}) } }, { status });

export interface RecordedCall {
  method: string;
  /** Path relative to `/api/v1`, without the query string. */
  path: string;
  query: URLSearchParams;
  body: unknown;
  headers: Record<string, string>;
}

type Handler = Response | ((call: RecordedCall) => Response);

export function mockApi(routes: Record<string, Handler>) {
  const calls: RecordedCall[] = [];
  const all: Record<string, Handler> = {
    'GET /auth/csrf': () => data({ csrf_token: 'test-token' }),
    ...routes,
  };

  const fetchMock = vi.fn(async (input: string, init: RequestInit = {}) => {
    const url = new URL(input, 'http://localhost');
    const method = (init.method ?? 'GET').toUpperCase();
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const call: RecordedCall = {
      method,
      path,
      query: url.searchParams,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
      headers: (init.headers ?? {}) as Record<string, string>,
    };
    calls.push(call);

    const handler = all[`${method} ${path}`];
    if (!handler) throw new Error(`Unexpected API call: ${method} ${path}`);
    // A Response body can be read once; hand out a copy per call.
    return typeof handler === 'function' ? handler(call) : handler.clone();
  });
  vi.stubGlobal('fetch', fetchMock);

  return {
    calls,
    /** Calls that changed state (everything except GET). */
    mutations: () => calls.filter((call) => call.method !== 'GET'),
    find: (method: string, path: string) => calls.filter((call) => call.method === method && call.path === path),
  };
}
