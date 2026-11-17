import type { ApiErrorCode, FieldErrors } from './types';

export interface ApiErrorInit {
  status: number;
  code: ApiErrorCode | (string & {});
  message: string;
  details?: Record<string, string[]>;
  requestId?: string;
  retryAfter?: number;
  cause?: unknown;
}

/** Every failure surfaced by the API client is an `ApiError`. */
export class ApiError extends Error {
  /** HTTP status, or `0` when no response was received. */
  readonly status: number;
  readonly code: ApiErrorCode | (string & {});
  /** Per-field validation messages (422 `validation_failed`). */
  readonly details?: Record<string, string[]>;
  /** Server request id — include it when reporting problems. */
  readonly requestId?: string;
  /** Seconds to wait before retrying (429 `rate_limited`). */
  readonly retryAfter?: number;

  constructor(init: ApiErrorInit) {
    super(init.message, init.cause === undefined ? undefined : { cause: init.cause });
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.details = init.details;
    this.requestId = init.requestId;
    this.retryAfter = init.retryAfter;
  }

  get isValidation(): boolean {
    return this.code === 'validation_failed';
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }

  get isNetwork(): boolean {
    return this.code === 'network_error';
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Human-readable message for any thrown value. */
export function errorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (isApiError(error)) return error.message || fallback;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/**
 * Map a 422 response's `details` to one message per field.
 * Returns `{}` for any other error.
 */
export function apiFieldErrors(error: unknown): FieldErrors {
  if (!isApiError(error) || !error.details) return {};
  const result: FieldErrors = {};
  for (const [field, messages] of Object.entries(error.details)) {
    const first = messages[0];
    if (first) result[field] = first;
  }
  return result;
}
