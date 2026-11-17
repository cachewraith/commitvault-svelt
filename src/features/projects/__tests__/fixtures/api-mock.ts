/**
 * Test helper: a `fetch` stub that routes by method + path and records every
 * call. Shared by the projects, environments, tags and settings test suites.
 *
 *   const api = mockApi({
 *     'GET /tags': () => page([]),
 *     'POST /tags': ({ body }) => data({ id: 't1', ...body }, 201),
 *   });
 *   expect(api.calls('POST /tags')[0].body).toEqual({ name: 'urgent' });
 */
import { vi } from 'vitest';

export interface ApiCall {
  method: string;
  /** Path relative to `/api/v1`, without the query string. */
  path: string;
  query: URLSearchParams;
  body: unknown;
  headers: Record<string, string>;
}

type Handler = (call: ApiCall) => Response | Promise<Response>;

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

/** `{ data }` envelope. */
export const data = (value: unknown, status = 200): Response => json({ data: value }, status);

/** Paginated envelope containing every item on one page. */
export const page = (items: unknown[]): Response =>
  json({ data: items, meta: { page: 1, per_page: 25, total: items.length, total_pages: items.length ? 1 : 0 } });

export const noContent = (): Response => new Response(null, { status: 204 });

export const apiError = (
  status: number,
  code: string,
  message: string,
  details?: Record<string, string[]>,
): Response => json({ error: { code, message, ...(details ? { details } : {}) } }, status);

/**
 * Stub `fetch`. Routes are `"METHOD /path"`; a path segment `:id` matches any
 * value. `GET /auth/csrf` is answered automatically. Unknown requests fail the
 * test with a clear message.
 */
export function mockApi(routes: Record<string, Handler>) {
  const recorded: ApiCall[] = [];
  const table = Object.entries(routes).map(([key, handler]) => {
    const [method = 'GET', pattern = '/'] = key.split(' ');
    const expression = new RegExp(`^${pattern.replace(/:[A-Za-z]+/g, '[^/]+')}$`);
    return { key, method, expression, handler };
  });

  const fetchMock = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.toString(), 'http://localhost');
    const method = (init.method ?? 'GET').toUpperCase();
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const call: ApiCall = {
      method,
      path,
      query: url.searchParams,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
      headers: (init.headers ?? {}) as Record<string, string>,
    };

    if (method === 'GET' && path === '/auth/csrf') return data({ csrf_token: 'test-csrf' });

    recorded.push(call);
    const route = table.find((entry) => entry.method === method && entry.expression.test(path));
    if (!route) throw new Error(`Unexpected API call: ${method} ${path}${url.search}`);
    return route.handler(call);
  });

  vi.stubGlobal('fetch', fetchMock);

  return {
    fetchMock,
    /** Recorded calls, optionally only those matching `"METHOD /path"`. */
    calls(key?: string): ApiCall[] {
      if (!key) return recorded;
      const [method = 'GET', pattern = '/'] = key.split(' ');
      const expression = new RegExp(`^${pattern.replace(/:[A-Za-z]+/g, '[^/]+')}$`);
      return recorded.filter((call) => call.method === method && expression.test(call.path));
    },
  };
}
