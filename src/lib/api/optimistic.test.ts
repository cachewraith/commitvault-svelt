import { describe, expect, it } from 'vitest';
import { createQueryClient } from './query-client';
import { removeFromCache } from './optimistic';

describe('removeFromCache', () => {
  it('removes a record from every cached shape and restores it on demand', () => {
    const client = createQueryClient();
    const page = { data: [{ id: 'a' }, { id: 'b' }], meta: { page: 1, per_page: 25, total: 2, total_pages: 1 } };
    client.setQueryData(['commits', 'list', {}], page);
    client.setQueryData(['commits', 'list', { project_id: 'p' }], { data: [{ id: 'c' }], meta: { total: 1 } });
    client.setQueryData(['environments', 'by-project', 'p'], [{ id: 'a' }, { id: 'x' }]);
    client.setQueryData(['dashboard', 'summary'], { totals: { commits: 2 }, recent_commits: [{ id: 'a' }], recent_notes: [] });

    const restore = removeFromCache(client, 'a', [['commits', 'list'], ['environments'], ['dashboard']]);

    expect(client.getQueryData(['commits', 'list', {}])).toEqual({
      data: [{ id: 'b' }],
      meta: { page: 1, per_page: 25, total: 1, total_pages: 1 },
    });
    // Lists without the record are left as they are (same object).
    expect(client.getQueryData(['commits', 'list', { project_id: 'p' }])).toEqual({ data: [{ id: 'c' }], meta: { total: 1 } });
    expect(client.getQueryData(['environments', 'by-project', 'p'])).toEqual([{ id: 'x' }]);
    expect(client.getQueryData(['dashboard', 'summary'])).toEqual({
      totals: { commits: 2 },
      recent_commits: [],
      recent_notes: [],
    });

    restore();
    expect(client.getQueryData(['commits', 'list', {}])).toEqual(page);
    expect(client.getQueryData(['environments', 'by-project', 'p'])).toEqual([{ id: 'a' }, { id: 'x' }]);
  });
});
