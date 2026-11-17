/** Pure path-matching helpers (no DOM, no Svelte) — unit-tested in match.test.ts. */

/** Extracts `:param` names from a pattern: `/a/:x/b/:y` → `'x' | 'y'`. */
export type ParamNames<Path extends string> = Path extends `${string}:${infer Param}/${infer Rest}`
  ? Param | ParamNames<`/${Rest}`>
  : Path extends `${string}:${infer Param}`
    ? Param
    : never;

/** Params object for a pattern; `Record<string, never>` when it has none. */
export type RouteParams<Path extends string> = [ParamNames<Path>] extends [never]
  ? Record<string, never>
  : { [K in ParamNames<Path>]: string };

interface Segment {
  kind: 'static' | 'param';
  value: string;
}

export interface CompiledPattern {
  pattern: string;
  segments: Segment[];
  /** Higher wins when several patterns match (static segments outrank params). */
  score: number;
}

function splitPath(path: string): string[] {
  return path.split('/').filter((part) => part !== '');
}

export function compilePattern(pattern: string): CompiledPattern {
  const segments = splitPath(pattern).map<Segment>((part) =>
    part.startsWith(':') ? { kind: 'param', value: part.slice(1) } : { kind: 'static', value: part },
  );
  const score = segments.reduce((total, segment) => total * 2 + (segment.kind === 'static' ? 1 : 0), 1);
  return { pattern, segments, score };
}

/** Returns decoded params when `pathname` matches, otherwise `null`. */
export function matchPattern(
  compiled: CompiledPattern,
  pathname: string,
): Record<string, string> | null {
  const parts = splitPath(pathname);
  if (parts.length !== compiled.segments.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < parts.length; i++) {
    const segment = compiled.segments[i]!;
    const part = parts[i]!;
    if (segment.kind === 'static') {
      if (segment.value !== part) return null;
    } else {
      try {
        params[segment.value] = decodeURIComponent(part);
      } catch {
        return null;
      }
    }
  }
  return params;
}

/** Pick the most specific matching pattern. */
export function findMatch<T extends { compiled: CompiledPattern }>(
  routes: readonly T[],
  pathname: string,
): { route: T; params: Record<string, string> } | null {
  let best: { route: T; params: Record<string, string> } | null = null;
  for (const route of routes) {
    const params = matchPattern(route.compiled, pathname);
    if (params && (!best || route.compiled.score > best.route.compiled.score)) {
      best = { route, params };
    }
  }
  return best;
}

/** Fill a pattern with params: `buildPath('/projects/:projectId', { projectId })`. */
export function buildPath<Path extends string>(pattern: Path, params: RouteParams<Path>): string {
  const values = params as Record<string, string>;
  const path = splitPath(pattern)
    .map((part) => {
      if (!part.startsWith(':')) return part;
      const value = values[part.slice(1)];
      if (value === undefined || value === '') {
        throw new Error(`Missing route param "${part.slice(1)}" for pattern "${pattern}"`);
      }
      return encodeURIComponent(value);
    })
    .join('/');
  return `/${path}`;
}

export type QueryInput = Record<string, string | number | boolean | null | undefined>;

/** Append a query string to a path, skipping empty values. */
export function withQuery(path: string, query?: QueryInput): string {
  if (!query) return path;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `${path}?${text}` : path;
}

/**
 * Only allow same-origin, absolute-path redirect targets (`/notes/1?x=y`).
 * Guards the `?next=` login parameter against open redirects.
 */
export function safeInternalPath(target: string | null | undefined, fallback = '/'): string {
  if (!target) return fallback;
  if (!target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) return fallback;
  if (target.startsWith('/api/') || target === '/api') return fallback;
  return target;
}
