import type { RouteDefinition } from './router.svelte';

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

/**
 * Loads the code of every route the user can open while the browser is idle,
 * so the first visit to each screen does not wait for its chunk. Each route
 * is one small chunk; the rich-text editor stays lazy (it is loaded by the
 * editor component, not by a route). Skipped when the user asked to save
 * data or the connection is very slow. Errors are ignored — the route loads
 * normally on navigation.
 */
export function prefetchRoutes(routes: readonly RouteDefinition[]): void {
  if (typeof window === 'undefined') return;
  const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  if (connection?.saveData || connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g') return;

  const queue = routes.filter((route) => (route.access ?? 'private') === 'private');
  const idle: (callback: () => void) => void =
    'requestIdleCallback' in window
      ? (callback) => window.requestIdleCallback(callback, { timeout: 3000 })
      : (callback) => setTimeout(callback, 200);

  const next = () => {
    const route = queue.shift();
    if (!route) return;
    route
      .load()
      .catch(() => undefined)
      .finally(() => idle(next));
  };
  idle(next);
}
