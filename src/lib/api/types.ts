/**
 * Wire-level types shared by every endpoint. Resource types (Project, Commit, …)
 * come from the generated OpenAPI schema (`bun run gen:api` → `schema.d.ts`).
 */

/** Single-resource success envelope: `{ "data": T }`. */
export interface ApiEnvelope<T> {
  data: T;
}

/** Pagination metadata returned by every list endpoint. */
export interface PageMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

/** List success envelope: `{ "data": T[], "meta": PageMeta }`. */
export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export type SortOrder = 'asc' | 'desc';

/** Query parameters accepted by every list endpoint. Extend per resource. */
export interface ListParams {
  page?: number;
  per_page?: number;
  sort?: string;
  order?: SortOrder;
  search?: string;
}

/** Error codes the backend emits, plus client-side synthetic codes. */
export type ApiErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'invalid_credentials'
  | 'forbidden'
  | 'csrf_invalid'
  | 'not_found'
  | 'conflict'
  | 'validation_failed'
  | 'rate_limited'
  | 'internal_error'
  /** Client-side: the request never reached the server (offline, DNS, CORS, …). */
  | 'network_error'
  /** Client-side: the request was aborted via an AbortSignal. */
  | 'aborted'
  /** Client-side: the server answered with something that is not the documented JSON shape. */
  | 'invalid_response';

/** Error envelope: `{ "error": { code, message, details?, request_id? } }`. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
    request_id?: string;
  };
}

/** Field name → first validation message, ready for `<FormField error={…}>`. */
export type FieldErrors = Record<string, string>;

export type QueryValue = string | number | boolean | Date | null | undefined;
/** Arrays are serialised comma-separated: `{ types: ['a','b'] }` → `types=a,b`. */
export type QueryParams = Record<string, QueryValue | readonly QueryValue[]>;
