/**
 * Minimal typed History-API router for the SPA.
 *
 *   import { router, navigate, setQuery } from '$lib/router';
 *
 *   router.pathname          // '/projects/42'
 *   router.params            // { projectId: '42' }
 *   router.query.get('tab')  // reactive read of ?tab=
 *   navigate('/commits');
 *   setQuery({ page: 2, search: null });   // merge into the query string
 *
 * State is held in runes, so reads inside `$derived`/`$effect`/markup are reactive.
 */
import type { Component } from 'svelte';
import { SvelteURLSearchParams } from 'svelte/reactivity';
import { compilePattern, findMatch, type CompiledPattern, type QueryInput } from './match';

export type RouteAccess =
  /** Requires a signed-in session (default). */
  | 'private'
  /** Only for signed-out visitors (login). Signed-in users are redirected away. */
  | 'guest'
  /** Reachable either way. */
  | 'public';

export type RouteLayout = 'app' | 'auth';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PageModule = { default: Component<any> };

export interface RouteDefinition {
  /** Path pattern, e.g. `/projects/:projectId`. */
  path: string;
  /** Lazy page loader — one chunk per route. */
  load: () => Promise<PageModule>;
  /** Document title (without the app suffix). Pages may refine it with `setPageTitle`. */
  title?: string;
  /** Defaults to `'private'`. */
  access?: RouteAccess;
  /** Defaults to `'app'` (sidebar + top bar). */
  layout?: RouteLayout;
  /** Sidebar item to highlight, when it is not derivable from the path. */
  nav?: string;
}

export interface ResolvedRoute extends Required<Pick<RouteDefinition, 'path' | 'load' | 'access' | 'layout'>> {
  title?: string;
  nav?: string;
  compiled: CompiledPattern;
}

export interface NavigateOptions {
  /** Replace the current history entry instead of pushing a new one. */
  replace?: boolean;
  /** Keep the scroll position (default: scroll to top on path changes). */
  keepScroll?: boolean;
  /** Arbitrary state stored on the history entry. */
  state?: unknown;
}

const APP_NAME = 'CommitVault';

class Router {
  #routes: ResolvedRoute[] = [];
  #notFound: ResolvedRoute | null = null;
  #started = false;

  /** Current path, without query string or hash. */
  pathname = $state('/');
  /** Current hash including `#`, or `''`. */
  hash = $state('');
  /** Reactive view of the current query string. Mutate through `setQuery`. */
  readonly query = new SvelteURLSearchParams();
  /** Matched route definition (or the not-found route). */
  route = $state.raw<ResolvedRoute | null>(null);
  /** Decoded `:params` of the matched route. */
  params = $state.raw<Record<string, string>>({});
  /** True when no route pattern matched the current path. */
  isNotFound = $state(false);

  /** Path + query + hash of the current location. */
  get fullPath(): string {
    const search = this.query.toString();
    return `${this.pathname}${search ? `?${search}` : ''}${this.hash}`;
  }

  /** Register routes and start listening. Call once, before mounting the app. */
  start(routes: readonly RouteDefinition[], notFound: RouteDefinition): void {
    this.#routes = routes.map(resolve);
    this.#notFound = resolve(notFound);
    this.#sync();
    if (this.#started || typeof window === 'undefined') return;
    this.#started = true;
    window.addEventListener('popstate', () => this.#sync());
    document.addEventListener('click', (event) => this.#onClick(event));
  }

  navigate(to: string, options: NavigateOptions = {}): void {
    const url = new URL(to, window.location.href);
    if (url.origin !== window.location.origin) {
      window.location.assign(url.href);
      return;
    }
    const target = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const pathChanged = url.pathname !== window.location.pathname;

    if (options.replace || target === current) {
      window.history.replaceState(options.state ?? null, '', target);
    } else {
      window.history.pushState(options.state ?? null, '', target);
    }
    this.#sync();

    if (pathChanged && !options.keepScroll) {
      window.scrollTo({ top: 0, left: 0 });
    }
  }

  /**
   * Merge values into the query string. `null`, `undefined` and `''` remove a
   * key. Replaces the history entry by default so filters do not flood history.
   */
  setQuery(values: QueryInput, options: { replace?: boolean } = {}): void {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined || value === null || value === '') next.delete(key);
      else next.set(key, String(value));
    }
    const search = next.toString();
    this.navigate(`${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`, {
      replace: options.replace ?? true,
      keepScroll: true,
    });
  }

  back(fallback = '/'): void {
    if (window.history.length > 1) window.history.back();
    else this.navigate(fallback, { replace: true });
  }

  #sync(): void {
    const { pathname, search, hash } = window.location;
    const normalised = normalisePath(pathname);
    const match = findMatch(this.#routes, normalised);

    this.pathname = normalised;
    this.hash = hash;
    syncSearchParams(this.query, new URLSearchParams(search));
    this.route = match?.route ?? this.#notFound;
    this.params = match?.params ?? {};
    this.isNotFound = match === null;
    setPageTitle(this.route?.title);
  }

  #onClick(event: MouseEvent): void {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!anchor) return;
    if (anchor.target && anchor.target !== '_self') return;
    if (anchor.hasAttribute('download') || anchor.dataset.native !== undefined) return;
    if (anchor.getAttribute('rel')?.includes('external')) return;

    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return;

    // Same-page hash links keep native behaviour (scroll to anchor).
    if (
      url.pathname === window.location.pathname &&
      url.search === window.location.search &&
      url.hash !== ''
    ) {
      return;
    }

    event.preventDefault();
    this.navigate(`${url.pathname}${url.search}${url.hash}`);
  }
}

function resolve(definition: RouteDefinition): ResolvedRoute {
  return {
    path: definition.path,
    load: definition.load,
    title: definition.title,
    nav: definition.nav,
    access: definition.access ?? 'private',
    layout: definition.layout ?? 'app',
    compiled: compilePattern(definition.path),
  };
}

/** Collapse duplicate slashes and drop a trailing slash (except for the root). */
function normalisePath(pathname: string): string {
  const collapsed = pathname.replace(/\/{2,}/g, '/');
  return collapsed.length > 1 && collapsed.endsWith('/') ? collapsed.slice(0, -1) : collapsed || '/';
}

/** Update the reactive params in place, touching only keys that actually changed. */
function syncSearchParams(target: URLSearchParams, source: URLSearchParams): void {
  for (const key of [...target.keys()]) {
    if (!source.has(key)) target.delete(key);
  }
  for (const key of new Set(source.keys())) {
    const next = source.getAll(key);
    const current = target.getAll(key);
    if (next.length !== current.length || next.some((value, i) => value !== current[i])) {
      target.delete(key);
      for (const value of next) target.append(key, value);
    }
  }
}

/** Set the document title; call from a page once its record name is known. */
export function setPageTitle(title: string | null | undefined): void {
  if (typeof document === 'undefined') return;
  document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
}

export const router = new Router();

export const navigate = (to: string, options?: NavigateOptions): void => router.navigate(to, options);
export const setQuery = (values: QueryInput, options?: { replace?: boolean }): void =>
  router.setQuery(values, options);
