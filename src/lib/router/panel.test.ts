import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  installPanelLinks,
  openPanelFor,
  panelTargetFor,
  recordPanel,
  registerPanelRoutes,
  setPanelHostMounted,
} from './panel.svelte';
import { navigate, router } from './router.svelte';

const page = () => Promise.resolve({ default: (() => {}) as never });

beforeAll(() => {
  router.start(
    [
      { path: '/commits', title: 'Commits', load: page },
      { path: '/commits/:commitId', title: 'Commit', load: page },
      { path: '/projects/:projectId', title: 'Project', load: page },
    ],
    { path: '/404', title: 'Page not found', access: 'public', load: page },
  );
  registerPanelRoutes([
    { type: 'commit', path: '/commits/:commitId' },
    { type: 'project', path: '/projects/:projectId' },
  ]);
  installPanelLinks();
  setPanelHostMounted(true);
});

afterAll(() => setPanelHostMounted(false));

beforeEach(() => navigate('/commits?project_id=p1', { replace: true }));

const popstate = () => new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));

/** Clicks a link and reports whether it was turned into a panel open (the default action was prevented). */
function clickLink(href: string, init: MouseEventInit = {}, attributes: Record<string, string> = {}): boolean {
  const container = document.createElement('div');
  for (const [name, value] of Object.entries(attributes)) container.setAttribute(name, value);
  const anchor = document.createElement('a');
  anchor.href = href;
  container.append(anchor);
  document.body.append(container);
  let prevented = false;
  const record = (event: Event) => {
    prevented = event.defaultPrevented;
    event.preventDefault(); // keep jsdom from navigating
  };
  window.addEventListener('click', record, { once: true });
  anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init }));
  container.remove();
  return prevented;
}

describe('record panel', () => {
  it('recognises record links only', () => {
    expect(panelTargetFor('/commits/c1')).toEqual({ type: 'commit', id: 'c1' });
    expect(panelTargetFor('/projects/p1')).toEqual({ type: 'project', id: 'p1' });
    expect(panelTargetFor('/commits')).toBeNull();
    expect(panelTargetFor('/commits/c1?x=1')).toBeNull();
    expect(panelTargetFor('https://example.com/commits/c1')).toBeNull();
  });

  it('opens by pushing ?panel= and closes with a history step back', async () => {
    const before = window.history.length;
    recordPanel.open({ type: 'commit', id: 'c1' });
    expect(recordPanel.current).toEqual({ type: 'commit', id: 'c1' });
    expect(window.location.search).toBe('?project_id=p1&panel=commit.c1');
    expect(window.history.length).toBe(before + 1);
    expect(recordPanel.shows('/commits/c1')).toBe(true);
    expect(recordPanel.shows('/commits/c2')).toBe(false);

    // Switching records replaces the entry instead of stacking.
    recordPanel.open({ type: 'project', id: 'p9' });
    expect(window.history.length).toBe(before + 1);

    const back = popstate();
    recordPanel.close();
    await back;
    expect(recordPanel.current).toBeNull();
    expect(window.location.search).toBe('?project_id=p1');
  });

  it('closes a deep-linked panel by dropping the key, without leaving the page', () => {
    navigate('/commits?project_id=p1&panel=commit.c9', { replace: true });
    const back = vi.spyOn(window.history, 'back');
    recordPanel.open({ type: 'commit', id: 'c3' });
    recordPanel.close();
    expect(back).not.toHaveBeenCalled();
    expect(recordPanel.current).toBeNull();
    expect(window.location.pathname).toBe('/commits');
    expect(window.location.search).toBe('?project_id=p1');
    back.mockRestore();
  });

  it('turns plain clicks on record links into panel opens', () => {
    expect(clickLink('/commits/c1')).toBe(true);
    expect(recordPanel.current).toEqual({ type: 'commit', id: 'c1' });
    expect(window.location.pathname).toBe('/commits');
  });

  it('leaves modifier clicks, full-page links and ordinary links alone', () => {
    expect(clickLink('/commits/c1', { metaKey: true })).toBe(false);
    expect(recordPanel.current).toBeNull();
    // A full-page link is left to the router, which navigates to the record's page.
    clickLink('/commits/c1', {}, { 'data-full-page': '' });
    expect(recordPanel.current).toBeNull();
    expect(window.location.pathname).toBe('/commits/c1');
    navigate('/commits', { replace: true });
    // Not a panel record: the router handles it as a normal navigation.
    clickLink('/commits');
    expect(recordPanel.current).toBeNull();
  });

  it('does nothing without a mounted host, or for the page already shown', () => {
    setPanelHostMounted(false);
    expect(openPanelFor('/commits/c1')).toBe(false);
    setPanelHostMounted(true);

    navigate('/commits/c1', { replace: true });
    expect(openPanelFor('/commits/c1')).toBe(false);
    expect(openPanelFor('/projects/p1')).toBe(true);
  });
});
