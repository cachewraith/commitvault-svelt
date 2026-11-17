/**
 * Centralised HTTP client for the CommitVault REST API.
 *
 * - Same-origin, cookie-authenticated (`credentials: 'same-origin'`).
 * - Unwraps the `{ data }` / `{ data, meta }` envelopes.
 * - Attaches `X-CSRF-Token` to every state-changing request; fetches the token
 *   lazily and retries once when the server answers `csrf_invalid`.
 * - Normalises every failure into an `ApiError`.
 * - Reports 401s on non-auth endpoints through `setUnauthorizedHandler`.
 *
 * Feature code must go through this module (via `features/<x>/api.ts`); never
 * call `fetch` directly from components.
 */
import { ApiError } from './errors';
import type { ApiEnvelope, ApiErrorBody, Paginated, QueryParams } from './types';

export const API_BASE = '/api/v1';
export const CSRF_HEADER = 'X-CSRF-Token';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const UNSAFE_METHODS: ReadonlySet<HttpMethod> = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export interface RequestOptions {
  /**
   * Query-string parameters: any plain object of strings, numbers, booleans,
   * Dates or arrays of those (so typed filter interfaces can be passed as-is).
   * `undefined`, `null`, `''` and empty arrays are skipped.
   */
  query?: QueryParams | object;
  /** Abort the request (TanStack Query passes one to every `queryFn`). */
  signal?: AbortSignal;
  /** Extra request headers. */
  headers?: Record<string, string>;
}

interface InternalOptions extends RequestOptions {
  body?: unknown;
}

// --- CSRF token -------------------------------------------------------------

let csrfToken: string | null = null;
let csrfRequest: Promise<string> | null = null;

/** Store a token received from `/auth/login` or `/auth/me` (it rotates on login). */
export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

/** Forget the cached token (logout, session expiry). */
export function clearCsrfToken(): void {
  csrfToken = null;
  csrfRequest = null;
}

async function fetchCsrfToken(): Promise<string> {
  // De-duplicate concurrent fetches.
  csrfRequest ??= (async () => {
    try {
      const body = await send<ApiEnvelope<{ csrf_token: string }>>('GET', '/auth/csrf', {});
      const token = body?.data?.csrf_token;
      if (typeof token !== 'string' || token === '') {
        throw new ApiError({
          status: 0,
          code: 'invalid_response',
          message: 'The server did not return a CSRF token.',
        });
      }
      csrfToken = token;
      return token;
    } finally {
      csrfRequest = null;
    }
  })();
  return csrfRequest;
}

async function ensureCsrfToken(): Promise<string> {
  return csrfToken ?? fetchCsrfToken();
}

// --- 401 handling -----------------------------------------------------------

type UnauthorizedHandler = (error: ApiError) => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

/**
 * Register the callback invoked when a non-auth endpoint answers 401
 * (session expired or revoked). The app uses it to clear session state, which
 * makes the router guard redirect to the login page.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

/** `/auth/*` endpoints use 401 as a normal answer ("not signed in", "bad credentials"). */
function isAuthPath(path: string): boolean {
  return path === '/auth' || path.startsWith('/auth/');
}

// --- URL building -----------------------------------------------------------

function serializeValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null;
  if (typeof value !== 'string') return null; // objects/functions are never sent
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Serialise query parameters. Skips `undefined`, `null`, empty strings and
 * empty arrays; arrays become a single comma-separated value.
 */
export function buildQuery(params: QueryParams | object | undefined): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, raw] of Object.entries(params)) {
    if (Array.isArray(raw)) {
      const parts = raw.map(serializeValue).filter((part): part is string => part !== null);
      if (parts.length > 0) search.set(key, parts.join(','));
    } else {
      const value = serializeValue(raw);
      if (value !== null) search.set(key, value);
    }
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

/** Absolute request URL for an API path such as `/projects`. */
export function apiUrl(path: string, query?: QueryParams | object): string {
  const normalised = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalised}${buildQuery(query)}`;
}

// --- Core request -----------------------------------------------------------

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, Math.ceil((date - Date.now()) / 1000));
  return undefined;
}

const STATUS_MESSAGES: Record<number, string> = {
  400: 'The request was not valid.',
  401: 'You are not signed in.',
  403: 'You are not allowed to do that.',
  404: 'Not found.',
  409: 'That conflicts with existing data.',
  413: 'The request is too large.',
  422: 'Some fields are not valid.',
  429: 'Too many attempts. Please wait and try again.',
  502: 'The server is unavailable. Please try again shortly.',
  503: 'The server is unavailable. Please try again shortly.',
  504: 'The server took too long to respond.',
};

const STATUS_CODES: Record<number, string> = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  422: 'validation_failed',
  429: 'rate_limited',
};

async function toApiError(response: Response): Promise<ApiError> {
  let body: Partial<ApiErrorBody> | undefined;
  try {
    body = (await response.json()) as Partial<ApiErrorBody>;
  } catch {
    body = undefined;
  }
  const error = body?.error;
  const hasShape = typeof error?.code === 'string' && typeof error?.message === 'string';
  return new ApiError({
    status: response.status,
    code: hasShape
      ? error.code
      : (STATUS_CODES[response.status] ??
        (response.status >= 500 ? 'internal_error' : 'invalid_response')),
    message: hasShape
      ? error.message
      : (STATUS_MESSAGES[response.status] ?? `Request failed (${response.status}).`),
    details: hasShape ? error.details : undefined,
    requestId: (hasShape ? error.request_id : undefined) ?? response.headers.get('x-request-id') ?? undefined,
    retryAfter: parseRetryAfter(response.headers.get('retry-after')),
  });
}

/** One HTTP exchange, no CSRF/401 policy. Returns the parsed JSON body or `undefined` (204). */
async function send<T>(
  method: HttpMethod,
  path: string,
  options: InternalOptions,
  csrf?: string,
): Promise<T | undefined> {
  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  if (csrf) headers[CSRF_HEADER] = csrf;

  let response: Response;
  try {
    response = await fetch(apiUrl(path, options.query), {
      method,
      headers,
      body,
      credentials: 'same-origin',
      signal: options.signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') {
      throw new ApiError({ status: 0, code: 'aborted', message: 'The request was cancelled.', cause });
    }
    throw new ApiError({
      status: 0,
      code: 'network_error',
      message: 'Cannot reach the server. Check your connection and try again.',
      cause,
    });
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204 || response.status === 205) return undefined;

  const text = await response.text();
  if (text === '') return undefined;
  try {
    return JSON.parse(text) as T;
  } catch (cause) {
    throw new ApiError({
      status: response.status,
      code: 'invalid_response',
      message: 'The server returned an unreadable response.',
      cause,
    });
  }
}

/**
 * Perform a request with the full client policy (CSRF + 401 hook) and return
 * the raw JSON body. Prefer the `api.*` helpers below.
 */
export async function request<T>(
  method: HttpMethod,
  path: string,
  options: InternalOptions = {},
): Promise<T | undefined> {
  const unsafe = UNSAFE_METHODS.has(method);
  try {
    if (!unsafe) return await send<T>(method, path, options);

    const token = await ensureCsrfToken();
    try {
      return await send<T>(method, path, options, token);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403 && error.code === 'csrf_invalid') {
        // Token rotated or expired: fetch a fresh one and retry exactly once.
        csrfToken = null;
        const fresh = await fetchCsrfToken();
        return await send<T>(method, path, options, fresh);
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && !isAuthPath(path)) {
      clearCsrfToken();
      unauthorizedHandler?.(error);
    }
    throw error;
  }
}

function requireBody<T>(body: T | undefined, path: string): T {
  if (body === undefined) {
    throw new ApiError({
      status: 0,
      code: 'invalid_response',
      message: `Expected a response body from ${path}.`,
    });
  }
  return body;
}

function unwrap<T>(body: ApiEnvelope<T> | undefined, path: string): T {
  const envelope = requireBody(body, path);
  if (typeof envelope !== 'object' || envelope === null || !('data' in envelope)) {
    throw new ApiError({
      status: 0,
      code: 'invalid_response',
      message: `Unexpected response shape from ${path}.`,
    });
  }
  return envelope.data;
}

/**
 * The API surface used by `features/<x>/api.ts` modules.
 *
 * - `get/post/put/patch` resolve to the unwrapped `data` payload.
 * - `list` resolves to `{ data, meta }` for paginated endpoints.
 * - Mutations that answer `204` (`del`, logout, …) resolve to `undefined`:
 *   call them as `api.post<void>(…)` / `api.del(…)`.
 */
export const api = {
  async get<T>(path: string, options?: RequestOptions): Promise<T> {
    return unwrap(await request<ApiEnvelope<T>>('GET', path, options), path);
  },

  async list<T>(path: string, options?: RequestOptions): Promise<Paginated<T>> {
    const body = requireBody(await request<Paginated<T>>('GET', path, options), path);
    if (!Array.isArray(body.data) || typeof body.meta !== 'object' || body.meta === null) {
      throw new ApiError({
        status: 0,
        code: 'invalid_response',
        message: `Unexpected list response shape from ${path}.`,
      });
    }
    return body;
  },

  async post<T = void>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return unwrapOptional<T>(await request<ApiEnvelope<T>>('POST', path, { ...options, body }));
  },

  async put<T = void>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return unwrapOptional<T>(await request<ApiEnvelope<T>>('PUT', path, { ...options, body }));
  },

  async patch<T = void>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return unwrapOptional<T>(await request<ApiEnvelope<T>>('PATCH', path, { ...options, body }));
  },

  async del(path: string, options?: RequestOptions): Promise<void> {
    await request<unknown>('DELETE', path, options);
  },
};

/** Mutations may answer 204 (no body) or `{ data }`. */
function unwrapOptional<T>(body: ApiEnvelope<T> | undefined): T {
  if (body === undefined) return undefined as T;
  return (typeof body === 'object' && body !== null && 'data' in body ? body.data : body) as T;
}
