import type { components } from '$lib/api/schema';

type Schemas = components['schemas'];

export type SearchResults = Schemas['SearchResponse'];
export type SearchHit = Schemas['SearchHit'];
export type SearchKind = Schemas['SearchKind'];

/** The groups of a `SearchResults`, in display order. */
export const SEARCH_GROUPS = ['projects', 'commits', 'deployments', 'releases', 'notes', 'tags'] as const;
export type SearchGroup = (typeof SEARCH_GROUPS)[number];
