import { api } from '$lib/api/client';
import type { SearchResults } from './types';

export interface SearchParams {
  /** 2–100 characters (422 otherwise). */
  q: string;
  project_id?: string;
  /** Hits per group, 1–20 (default 5). */
  limit?: number;
}

export const SEARCH_MIN_CHARS = 2;
export const SEARCH_MAX_CHARS = 100;

export const searchApi = {
  search: (params: SearchParams, signal?: AbortSignal) => api.get<SearchResults>('/search', { query: params, signal }),
};
