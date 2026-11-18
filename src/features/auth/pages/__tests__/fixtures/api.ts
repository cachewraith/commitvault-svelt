import { vi } from 'vitest';

export function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

export const csrf = () => json({ data: { csrf_token: 'tok' } });

export function apiError(
  status: number,
  code: string,
  message: string,
  extra: { details?: Record<string, string[]>; retryAfter?: number } = {},
): Response {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (extra.retryAfter !== undefined) headers['Retry-After'] = String(extra.retryAfter);
  return json({ error: { code, message, details: extra.details } }, { status, headers });
}

export const OPTIONS_URL = '/api/v1/auth/options';

/**
 * Stub `fetch`: `GET /auth/options` answers `{ email_enabled }` whenever it is
 * asked; every other request takes the next queued response, in order.
 * `calls()` lists those other requests as `[url, init]`.
 */
export function mockApi(responses: Response[], { emailEnabled = true } = {}) {
  const queue = [...responses];
  const fn = vi.fn(async (input: string, _init: RequestInit) => {
    if (input === OPTIONS_URL) return json({ data: { email_enabled: emailEnabled } });
    const next = queue.shift();
    if (!next) throw new Error(`Unexpected fetch call: ${input}`);
    return next;
  });
  vi.stubGlobal('fetch', fn);
  return {
    fetch: fn,
    calls: () => fn.mock.calls.filter(([url]) => url !== OPTIONS_URL),
    /** Parsed JSON body of the n-th non-options request. */
    body: (n: number) => JSON.parse(fn.mock.calls.filter(([url]) => url !== OPTIONS_URL)[n]![1].body as string),
  };
}

export const inSeconds = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();
