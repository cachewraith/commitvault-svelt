import { router } from './router.svelte';

export type SortDirection = 'asc' | 'desc';

/** One entry of a list's sort menu, e.g. `{ sort: 'created_at', order: 'desc', label: 'Newest first' }`. */
export interface SortOption<S extends string = string> {
  sort: S;
  order: SortDirection;
  label: string;
}

export interface SortState<S extends string> {
  /** Current sort field (`?sort=`, or the first option's). */
  readonly sort: S;
  /** Current direction (`?order=`, or the direction the menu lists first for this field). */
  readonly order: SortDirection;
  /** The menu entry matching the current state, if there is one. */
  readonly option: SortOption<S> | undefined;
  /** Apply a sort; resets the page. The first option is the default and leaves the URL clean. */
  set(sort: string, order: SortDirection): void;
}

/**
 * URL-backed sort state for a list (`?sort=&order=`). The first option is the
 * default — newest created first on every list. Unknown values in the URL
 * fall back to it.
 *
 *   const sorting = sortState(COMMIT_SORTS);
 *   commitsApi.list({ sort: sorting.sort, order: sorting.order });
 */
export function sortState<S extends string>(
  options: readonly [SortOption<S>, ...SortOption<S>[]],
): SortState<S> {
  const fallback = options[0];
  return {
    get sort() {
      const raw = router.query.get('sort');
      return (options.find((option) => option.sort === raw)?.sort ?? fallback.sort) as S;
    },
    get order() {
      const raw = router.query.get('order');
      if (raw === 'asc' || raw === 'desc') return raw;
      return options.find((option) => option.sort === this.sort)?.order ?? fallback.order;
    },
    get option() {
      return options.find((option) => option.sort === this.sort && option.order === this.order);
    },
    set(sort, order) {
      const isDefault = sort === fallback.sort && order === fallback.order;
      router.setQuery({ sort: isDefault ? null : sort, order: isDefault ? null : order, page: null });
    },
  };
}
