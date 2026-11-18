import type { QueryClient, QueryKey } from '@tanstack/svelte-query';

type WithId = { id: string };

const hasId = (value: unknown): value is WithId =>
  typeof value === 'object' && value !== null && typeof (value as WithId).id === 'string';

function withoutInArray(items: unknown[], id: string): unknown[] | null {
  const next = items.filter((item) => !(hasId(item) && item.id === id));
  return next.length === items.length ? null : next;
}

/**
 * The cached value without the record `id`, or `null` when it does not
 * contain it. Understands the shapes this app caches: paginated lists
 * (`{ data, meta }`, `meta.total` is adjusted), plain arrays, and objects
 * whose properties are lists (the dashboard).
 */
function without(value: unknown, id: string): unknown | null {
  if (Array.isArray(value)) return withoutInArray(value, id);
  if (typeof value !== 'object' || value === null) return null;

  const record = value as Record<string, unknown>;
  if (Array.isArray(record.data) && typeof record.meta === 'object' && record.meta !== null) {
    const data = withoutInArray(record.data, id);
    if (!data) return null;
    const meta = record.meta as { total?: number };
    return { ...record, data, meta: { ...meta, total: Math.max(0, (meta.total ?? data.length + 1) - 1) } };
  }

  let changed = false;
  const next: Record<string, unknown> = { ...record };
  for (const [key, item] of Object.entries(record)) {
    if (!Array.isArray(item)) continue;
    const filtered = withoutInArray(item, id);
    if (filtered) {
      next[key] = filtered;
      changed = true;
    }
  }
  return changed ? next : null;
}

/**
 * Optimistic delete: removes the record from every cached query under
 * `keys` right away, so it disappears from the screen without waiting for
 * the server. Returns a function that puts everything back (call it when
 * the request fails). Invalidate the same keys once the request settles.
 *
 *   onMutate: () => ({ restore: removeFromCache(queryClient, id, [queryKeys.commits.lists()]) }),
 *   onError: (error, _input, context) => context?.restore(),
 */
export function removeFromCache(queryClient: QueryClient, id: string, keys: readonly QueryKey[]): () => void {
  const snapshots: Array<[QueryKey, unknown]> = [];
  for (const key of keys) {
    // A refetch already on its way would bring the record back.
    void queryClient.cancelQueries({ queryKey: key });
    for (const [queryKey, data] of queryClient.getQueriesData({ queryKey: key })) {
      const next = without(data, id);
      if (next === null) continue;
      snapshots.push([queryKey, data]);
      queryClient.setQueryData(queryKey, next);
    }
  }
  return () => {
    for (const [queryKey, data] of snapshots) queryClient.setQueryData(queryKey, data);
  };
}
