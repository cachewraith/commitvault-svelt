import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { navigate, router } from './router.svelte';
import { sortState } from './sort.svelte';

const page = () => Promise.resolve({ default: (() => {}) as never });

const OPTIONS = [
  { sort: 'created_at', order: 'desc', label: 'Newest first' },
  { sort: 'created_at', order: 'asc', label: 'Oldest first' },
  { sort: 'name', order: 'asc', label: 'Name A–Z' },
  { sort: 'name', order: 'desc', label: 'Name Z–A' },
] as const;

beforeAll(() => {
  router.start([{ path: '/things', load: page }], { path: '/404', access: 'public', load: page });
});

beforeEach(() => navigate('/things?page=3', { replace: true }));

describe('sortState', () => {
  it('defaults to the first option (newest first) with a clean URL', () => {
    const sorting = sortState(OPTIONS);
    expect([sorting.sort, sorting.order]).toEqual(['created_at', 'desc']);
    expect(sorting.option?.label).toBe('Newest first');
  });

  it('writes other sorts to the URL, resets the page, and clears the default', () => {
    const sorting = sortState(OPTIONS);
    sorting.set('name', 'asc');
    expect(window.location.search).toBe('?sort=name&order=asc');
    expect(sorting.option?.label).toBe('Name A–Z');

    sorting.set('created_at', 'desc');
    expect(window.location.search).toBe('');
  });

  it('uses the direction listed first for a field when the URL has none', () => {
    navigate('/things?sort=name', { replace: true });
    expect(sortState(OPTIONS).order).toBe('asc');
  });

  it('falls back to the default for unknown values', () => {
    navigate('/things?sort=bogus&order=sideways', { replace: true });
    const sorting = sortState(OPTIONS);
    expect([sorting.sort, sorting.order]).toEqual(['created_at', 'desc']);
  });
});
