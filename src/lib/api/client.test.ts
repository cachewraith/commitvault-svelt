import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  api,
  apiUrl,
  buildQuery,
  clearCsrfToken,
  setCsrfToken,
  setUnauthorizedHandler,
} from './client';
import { ApiError, apiFieldErrors, errorMessage, isApiError } from './errors';

type FetchArgs = [input: string, init: RequestInit];

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  extra: { details?: Record<string, string[]>; request_id?: string; headers?: Record<string, string> } = {},
): Response {
  return json(
    { error: { code, message, details: extra.details, request_id: extra.request_id } },
    { status, headers: { 'Content-Type': 'application/json', ...extra.headers } },
  );
}

function mockFetch(...responses: Array<Response | (() => Response | Promise<Response>)>) {
  const queue = [...responses];
  const fn = vi.fn(async (..._args: FetchArgs) => {
    const next = queue.shift();
    if (!next) throw new Error('Unexpected fetch call');
    return typeof next === 'function' ? next() : next;
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

function headersOf(call: FetchArgs): Record<string, string> {
  return call[1].headers as Record<string, string>;
}

beforeEach(() => {
  clearCsrfToken();
  setUnauthorizedHandler(null);
});

describe('buildQuery', () => {
  it('skips undefined, null and empty values', () => {
    expect(buildQuery({ page: 1, search: '', sort: undefined, order: null, tag: '  ' })).toBe('?page=1');
  });

  it('serialises booleans, numbers, dates and arrays', () => {
    const date = new Date('2026-11-17T10:00:00.000Z');
    expect(buildQuery({ pinned: false, per_page: 50, from: date, types: ['commits', 'notes'] })).toBe(
      '?pinned=false&per_page=50&from=2026-11-17T10%3A00%3A00.000Z&types=commits%2Cnotes',
    );
  });

  it('drops empty arrays and trims strings', () => {
    expect(buildQuery({ types: [], search: '  fix  ' })).toBe('?search=fix');
    expect(buildQuery(undefined)).toBe('');
    expect(buildQuery({})).toBe('');
  });

  it('builds API URLs under /api/v1', () => {
    expect(apiUrl('/projects', { page: 2 })).toBe('/api/v1/projects?page=2');
    expect(apiUrl('projects')).toBe('/api/v1/projects');
  });
});

describe('api reads', () => {
  it('unwraps the data envelope and sends same-origin credentials', async () => {
    const fetchMock = mockFetch(json({ data: { id: 'p1', name: 'Vault' } }));

    const project = await api.get<{ id: string; name: string }>('/projects/p1');

    expect(project).toEqual({ id: 'p1', name: 'Vault' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/v1/projects/p1');
    expect(init.method).toBe('GET');
    expect(init.credentials).toBe('same-origin');
    expect(headersOf(fetchMock.mock.calls[0]!)).not.toHaveProperty('X-CSRF-Token');
  });

  it('returns data and meta for lists', async () => {
    const meta = { page: 2, per_page: 25, total: 60, total_pages: 3 };
    const fetchMock = mockFetch(json({ data: [{ id: 'a' }], meta }));

    const page = await api.list<{ id: string }>('/commits', { query: { page: 2, search: 'fix' } });

    expect(page).toEqual({ data: [{ id: 'a' }], meta });
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/v1/commits?page=2&search=fix');
  });

  it('rejects list responses that are not paginated', async () => {
    mockFetch(json({ data: { id: 'a' } }));
    await expect(api.list('/commits')).rejects.toMatchObject({ code: 'invalid_response' });
  });
});

describe('CSRF handling', () => {
  it('fetches the token lazily and attaches it to unsafe requests', async () => {
    const fetchMock = mockFetch(json({ data: { csrf_token: 'tok-1' } }), json({ data: { id: 'p1' } }));

    await api.post('/projects', { name: 'Vault' });

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/v1/auth/csrf',
      '/api/v1/projects',
    ]);
    const [, init] = fetchMock.mock.calls[1]!;
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ name: 'Vault' }));
    expect(headersOf(fetchMock.mock.calls[1]!)['X-CSRF-Token']).toBe('tok-1');
    expect(headersOf(fetchMock.mock.calls[1]!)['Content-Type']).toBe('application/json');
  });

  it('reuses the cached token and de-duplicates concurrent token fetches', async () => {
    const fetchMock = mockFetch(
      json({ data: { csrf_token: 'tok-1' } }),
      json({ data: { ok: 1 } }),
      json({ data: { ok: 2 } }),
      json({ data: { ok: 3 } }),
    );

    await Promise.all([api.post('/a', {}), api.post('/b', {})]);
    await api.patch('/c', {});

    const urls = fetchMock.mock.calls.map((call) => call[0]);
    expect(urls.filter((url) => url === '/api/v1/auth/csrf')).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('uses a token provided by login/me without fetching', async () => {
    setCsrfToken('from-login');
    const fetchMock = mockFetch(new Response(null, { status: 204 }));

    await api.del('/projects/p1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(headersOf(fetchMock.mock.calls[0]!)['X-CSRF-Token']).toBe('from-login');
  });

  it('refetches the token and retries once on csrf_invalid', async () => {
    setCsrfToken('stale');
    const fetchMock = mockFetch(
      errorResponse(403, 'csrf_invalid', 'CSRF token is missing or invalid.'),
      json({ data: { csrf_token: 'fresh' } }),
      json({ data: { id: 'p1' } }),
    );

    const result = await api.post<{ id: string }>('/projects', { name: 'Vault' });

    expect(result).toEqual({ id: 'p1' });
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/v1/projects',
      '/api/v1/auth/csrf',
      '/api/v1/projects',
    ]);
    expect(headersOf(fetchMock.mock.calls[0]!)['X-CSRF-Token']).toBe('stale');
    expect(headersOf(fetchMock.mock.calls[2]!)['X-CSRF-Token']).toBe('fresh');
  });

  it('does not retry more than once', async () => {
    setCsrfToken('stale');
    const fetchMock = mockFetch(
      errorResponse(403, 'csrf_invalid', 'bad'),
      json({ data: { csrf_token: 'fresh' } }),
      errorResponse(403, 'csrf_invalid', 'still bad'),
    );

    await expect(api.post('/projects', {})).rejects.toMatchObject({ status: 403, code: 'csrf_invalid' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry on a plain 403', async () => {
    setCsrfToken('tok');
    const fetchMock = mockFetch(errorResponse(403, 'forbidden', 'No.'));

    await expect(api.post('/projects', {})).rejects.toMatchObject({ code: 'forbidden' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('resolves undefined for 204 responses', async () => {
    setCsrfToken('tok');
    mockFetch(new Response(null, { status: 204 }));
    await expect(api.post<void>('/auth/logout')).resolves.toBeUndefined();
  });
});

describe('error parsing', () => {
  it('maps the error envelope to ApiError', async () => {
    mockFetch(
      errorResponse(422, 'validation_failed', 'Validation failed.', {
        details: { name: ['Name is required.', 'Too short.'], slug: ['Already taken.'] },
        request_id: 'req-123',
      }),
    );

    const error = await api.get('/projects').catch((e: unknown) => e);

    expect(isApiError(error)).toBe(true);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(422);
    expect(apiError.code).toBe('validation_failed');
    expect(apiError.message).toBe('Validation failed.');
    expect(apiError.requestId).toBe('req-123');
    expect(apiError.isValidation).toBe(true);
    expect(apiFieldErrors(apiError)).toEqual({ name: 'Name is required.', slug: 'Already taken.' });
  });

  it('reads Retry-After on 429', async () => {
    mockFetch(errorResponse(429, 'rate_limited', 'Slow down.', { headers: { 'Retry-After': '42' } }));

    const error = (await api.get('/x').catch((e: unknown) => e)) as ApiError;

    expect(error.isRateLimited).toBe(true);
    expect(error.retryAfter).toBe(42);
  });

  it('falls back to status-derived codes for non-JSON errors', async () => {
    mockFetch(new Response('<html>Bad Gateway</html>', { status: 502 }));

    const error = (await api.get('/x').catch((e: unknown) => e)) as ApiError;

    expect(error.status).toBe(502);
    expect(error.code).toBe('internal_error');
    expect(error.message).toMatch(/unavailable/i);
  });

  it('normalises network failures', async () => {
    mockFetch(() => {
      throw new TypeError('Failed to fetch');
    });

    const error = (await api.get('/x').catch((e: unknown) => e)) as ApiError;

    expect(error.status).toBe(0);
    expect(error.code).toBe('network_error');
    expect(error.isNetwork).toBe(true);
    expect(errorMessage(error)).toMatch(/cannot reach the server/i);
  });

  it('normalises aborted requests', async () => {
    mockFetch(() => {
      throw new DOMException('The operation was aborted.', 'AbortError');
    });

    await expect(api.get('/x')).rejects.toMatchObject({ code: 'aborted', status: 0 });
  });

  it('reports unparseable success bodies', async () => {
    mockFetch(new Response('not json', { status: 200 }));
    await expect(api.get('/x')).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('gives sensible messages for unknown thrown values', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
    expect(errorMessage('nope', 'Fallback.')).toBe('Fallback.');
    expect(apiFieldErrors(new Error('x'))).toEqual({});
  });
});

describe('401 hook', () => {
  it('invokes the unauthorized handler for non-auth endpoints', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    mockFetch(errorResponse(401, 'unauthorized', 'Sign in.'));

    await expect(api.get('/projects')).rejects.toMatchObject({ status: 401 });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]![0]).toBeInstanceOf(ApiError);
  });

  it('does not invoke the handler for /auth endpoints', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    setCsrfToken('tok');
    mockFetch(
      errorResponse(401, 'unauthorized', 'Not signed in.'),
      errorResponse(401, 'unauthorized', 'Bad credentials.'),
    );

    await expect(api.get('/auth/me')).rejects.toMatchObject({ status: 401 });
    await expect(api.post('/auth/login', { email: 'a@b.c', password: 'x' })).rejects.toMatchObject({
      status: 401,
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('forgets the CSRF token after a 401', async () => {
    setUnauthorizedHandler(() => {});
    setCsrfToken('old');
    const fetchMock = mockFetch(
      errorResponse(401, 'unauthorized', 'Expired.'),
      json({ data: { csrf_token: 'new' } }),
      json({ data: {} }),
    );

    await expect(api.post('/projects', {})).rejects.toMatchObject({ status: 401 });
    await api.post('/projects', {});

    expect(fetchMock.mock.calls[1]![0]).toBe('/api/v1/auth/csrf');
    expect(headersOf(fetchMock.mock.calls[2]!)['X-CSRF-Token']).toBe('new');
  });
});

describe('typed filter objects', () => {
  interface CommitFilters {
    page?: number;
    branch?: string;
    deployed?: boolean;
    nested?: { a: number };
  }

  it('accepts interfaces and ignores non-primitive values', () => {
    const filters: CommitFilters = { page: 2, branch: 'main', deployed: true, nested: { a: 1 } };
    expect(buildQuery(filters)).toBe('?page=2&branch=main&deployed=true');
  });
});
