/**
 * Query-key convention
 * --------------------
 *   [resource]                         → everything for a resource (invalidate after any mutation)
 *   [resource, 'list', params]         → one paginated/filtered list
 *   [resource, 'detail', id]           → one record
 *   [resource, <named>, ...args]       → special reads (e.g. environments 'compare')
 *
 * `params` objects are compared structurally by TanStack Query, so pass the
 * plain filter object (undefined values are fine — strip nothing by hand).
 *
 * After a mutation, invalidate the narrowest key that is certainly affected
 * plus `queryKeys.dashboard.all`, e.g.
 *
 *   queryClient.invalidateQueries({ queryKey: queryKeys.commits.all });
 *   queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
 */

type Params = object | undefined;

function resource<const R extends string>(name: R) {
  return {
    all: [name] as const,
    lists: () => [name, 'list'] as const,
    list: (params?: Params) => [name, 'list', params ?? {}] as const,
    details: () => [name, 'detail'] as const,
    detail: (id: string) => [name, 'detail', id] as const,
  };
}

export const queryKeys = {
  auth: {
    all: ['auth'] as const,
    me: () => ['auth', 'me'] as const,
  },

  dashboard: {
    all: ['dashboard'] as const,
    summary: () => ['dashboard', 'summary'] as const,
  },

  projects: resource('projects'),

  environments: {
    ...resource('environments'),
    /** All environments of one project (ordered), including latest recorded deployments. */
    byProject: (projectId: string) => ['environments', 'by-project', projectId] as const,
    /** Recorded-deployment comparison between two environments of a project. */
    compare: (projectId: string, params?: Params) =>
      ['environments', 'compare', projectId, params ?? {}] as const,
  },

  commits: resource('commits'),

  deployments: resource('deployments'),

  releases: resource('releases'),

  notes: {
    ...resource('notes'),
    /** Distinct note categories (for filters and autocomplete). */
    categories: (params?: Params) => ['notes', 'categories', params ?? {}] as const,
  },

  tags: resource('tags'),

  search: {
    all: ['search'] as const,
    results: (params?: Params) => ['search', 'results', params ?? {}] as const,
  },
} as const;
