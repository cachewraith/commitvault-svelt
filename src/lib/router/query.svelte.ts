import { router } from './router.svelte';

/**
 * Reactive, typed accessors for query-string values. Use inside components:
 *
 *   const page = queryNumber('page', 1);
 *   const search = queryString('search');
 *   // page.value / search.value are reactive; assigning updates the URL.
 *   search.value = 'fix';          // → ?search=fix  (and resets nothing else)
 *
 * Assigning the default value (or an empty string) removes the key from the URL.
 */
export interface QueryBinding<T> {
  value: T;
}

export function queryString(key: string, fallback = ''): QueryBinding<string> {
  return {
    get value() {
      return router.query.get(key) ?? fallback;
    },
    set value(next: string) {
      router.setQuery({ [key]: next === fallback ? null : next });
    },
  };
}

export function queryNumber(key: string, fallback: number): QueryBinding<number> {
  return {
    get value() {
      const raw = router.query.get(key);
      if (raw === null) return fallback;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : fallback;
    },
    set value(next: number) {
      router.setQuery({ [key]: next === fallback ? null : next });
    },
  };
}

export function queryBoolean(key: string, fallback = false): QueryBinding<boolean> {
  return {
    get value() {
      const raw = router.query.get(key);
      if (raw === null) return fallback;
      return raw === 'true' || raw === '1';
    },
    set value(next: boolean) {
      router.setQuery({ [key]: next === fallback ? null : next });
    },
  };
}

/** Constrain a query value to a known set (e.g. status filters, sort keys). */
export function queryEnum<const T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): QueryBinding<T>;
export function queryEnum<const T extends string>(
  key: string,
  allowed: readonly T[],
): QueryBinding<T | undefined>;
export function queryEnum<const T extends string>(
  key: string,
  allowed: readonly T[],
  fallback?: T,
): QueryBinding<T | undefined> {
  return {
    get value() {
      const raw = router.query.get(key);
      return raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
    },
    set value(next: T | undefined) {
      router.setQuery({ [key]: next === undefined || next === fallback ? null : next });
    },
  };
}
