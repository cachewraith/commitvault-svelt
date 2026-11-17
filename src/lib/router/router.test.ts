import { flushSync } from 'svelte';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { queryEnum, queryNumber, queryString } from './query.svelte';
import { navigate, router, setQuery } from './router.svelte';

const page = () => Promise.resolve({ default: (() => {}) as never });

beforeAll(() => {
  router.start(
    [
      { path: '/', title: 'Dashboard', load: page },
      { path: '/login', title: 'Sign in', access: 'guest', layout: 'auth', load: page },
      { path: '/commits', title: 'Commits', load: page },
      { path: '/commits/:commitId', title: 'Commit', load: page },
    ],
    { path: '/404', title: 'Page not found', access: 'public', load: page },
  );
});

beforeEach(() => {
  navigate('/', { replace: true });
});

/**
 * Click an anchor and report whether the router intercepted it. A window-level
 * listener (runs after the router's document listener) records the outcome and
 * then cancels the event so jsdom does not attempt a real navigation.
 */
function dispatchClick(id: string, init: MouseEventInit = {}): boolean {
  let intercepted = false;
  const record = (event: Event) => {
    intercepted = event.defaultPrevented;
    event.preventDefault();
  };
  window.addEventListener('click', record, { once: true });
  document
    .getElementById(id)!
    .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init }));
  return intercepted;
}

describe('router', () => {
  it('resolves routes, params and document title', () => {
    navigate('/commits/abc123?tab=deployments#top');

    expect(router.pathname).toBe('/commits/abc123');
    expect(router.params).toEqual({ commitId: 'abc123' });
    expect(router.route?.path).toBe('/commits/:commitId');
    expect(router.route?.access).toBe('private');
    expect(router.query.get('tab')).toBe('deployments');
    expect(router.hash).toBe('#top');
    expect(router.fullPath).toBe('/commits/abc123?tab=deployments#top');
    expect(router.isNotFound).toBe(false);
    expect(document.title).toBe('Commit · CommitVault');
  });

  it('falls back to the not-found route', () => {
    navigate('/does/not/exist');

    expect(router.isNotFound).toBe(true);
    expect(router.route?.path).toBe('/404');
    expect(router.route?.access).toBe('public');
    expect(document.title).toBe('Page not found · CommitVault');
  });

  it('normalises trailing and duplicate slashes', () => {
    navigate('/commits/');
    expect(router.pathname).toBe('/commits');
    expect(router.route?.path).toBe('/commits');
  });

  it('pushes history entries and reacts to back navigation', async () => {
    navigate('/commits');
    navigate('/commits/1');
    expect(window.location.pathname).toBe('/commits/1');

    window.history.back();
    await new Promise<void>((resolve) => window.addEventListener('popstate', () => resolve(), { once: true }));

    expect(router.pathname).toBe('/commits');
  });

  it('merges and removes query values without leaving the page', () => {
    navigate('/commits?page=3&search=fix');

    setQuery({ page: null, branch: 'main' });

    expect(router.pathname).toBe('/commits');
    expect(window.location.search).toBe('?search=fix&branch=main');
    expect(router.query.get('page')).toBeNull();
    expect(router.query.get('branch')).toBe('main');
  });

  it('intercepts same-origin link clicks', () => {
    document.body.innerHTML = `
      <a id="internal" href="/commits/9">open</a>
      <a id="external" href="https://example.com/x">ext</a>
      <a id="blank" href="/commits/7" target="_blank">new tab</a>
      <a id="api" href="/api/v1/export">api</a>`;
    const click = (id: string) => dispatchClick(id);

    expect(click('internal')).toBe(true);
    expect(router.pathname).toBe('/commits/9');

    expect(click('blank')).toBe(false);
    expect(click('api')).toBe(false);
    expect(click('external')).toBe(false);
    expect(router.pathname).toBe('/commits/9');
  });

  it('ignores modified clicks so "open in new tab" keeps working', () => {
    document.body.innerHTML = `<a id="link" href="/commits/5">open</a>`;
    expect(dispatchClick('link', { ctrlKey: true })).toBe(false);
    expect(router.pathname).toBe('/');
  });
});

describe('query bindings', () => {
  it('reads typed values with fallbacks', () => {
    navigate('/commits?page=4&search=fix&status=failed&bad=abc');

    expect(queryNumber('page', 1).value).toBe(4);
    expect(queryNumber('bad', 1).value).toBe(1);
    expect(queryNumber('missing', 7).value).toBe(7);
    expect(queryString('search').value).toBe('fix');
    expect(queryString('missing').value).toBe('');
    expect(queryEnum('status', ['successful', 'failed']).value).toBe('failed');
    expect(queryEnum('search', ['successful', 'failed']).value).toBeUndefined();
    expect(queryEnum('search', ['asc', 'desc'], 'desc').value).toBe('desc');
  });

  it('writes values and removes defaults from the URL', () => {
    navigate('/commits');
    const pageParam = queryNumber('page', 1);
    const search = queryString('search');

    pageParam.value = 3;
    search.value = 'deploy';
    flushSync();
    expect(window.location.search).toBe('?page=3&search=deploy');

    pageParam.value = 1;
    search.value = '';
    expect(window.location.search).toBe('');
  });
});
