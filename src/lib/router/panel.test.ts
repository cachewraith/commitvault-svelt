import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { detailPanel, openInPanel } from './panel.svelte';
import { navigate, router } from './router.svelte';

const page = () => Promise.resolve({ default: (() => {}) as never });

beforeAll(() => {
  router.start(
    [{ path: '/commits', title: 'Commits', load: page }],
    { path: '/404', title: 'Page not found', access: 'public', load: page },
  );
});

beforeEach(() => navigate('/commits?project_id=p1', { replace: true }));

const popstate = () => new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));

describe('detailPanel', () => {
  it('opens by pushing ?view= and closes with a history step back', async () => {
    const panel = detailPanel();
    const before = window.history.length;
    panel.open('c1');
    expect(panel.id).toBe('c1');
    expect(window.location.search).toBe('?project_id=p1&view=c1');
    expect(window.history.length).toBe(before + 1);

    // Switching records replaces the entry instead of stacking.
    panel.open('c2');
    expect(panel.id).toBe('c2');
    expect(window.history.length).toBe(before + 1);

    const back = popstate();
    panel.close();
    await back;
    expect(panel.id).toBeNull();
    expect(window.location.search).toBe('?project_id=p1');
  });

  it('closes a deep-linked panel by dropping the key, without leaving the page', () => {
    navigate('/commits?project_id=p1&view=c9', { replace: true });
    const panel = detailPanel();
    const back = vi.spyOn(window.history, 'back');
    expect(panel.id).toBe('c9');
    panel.open('c3');
    panel.close();
    expect(back).not.toHaveBeenCalled();
    expect(panel.id).toBeNull();
    expect(window.location.pathname).toBe('/commits');
    expect(window.location.search).toBe('?project_id=p1');
    back.mockRestore();
  });

  it('leaves modifier clicks to the link (full page / new tab)', () => {
    const panel = detailPanel();
    const handler = openInPanel(panel, 'c1');
    const modified = new MouseEvent('click', { button: 0, metaKey: true, cancelable: true });
    handler(modified);
    expect(modified.defaultPrevented).toBe(false);
    expect(panel.id).toBeNull();

    const plain = new MouseEvent('click', { button: 0, cancelable: true });
    handler(plain);
    expect(plain.defaultPrevented).toBe(true);
    expect(panel.id).toBe('c1');
  });
});
