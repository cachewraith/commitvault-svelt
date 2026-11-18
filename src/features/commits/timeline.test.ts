import { describe, expect, it } from 'vitest';
import { commit } from './__tests__/fixtures/records';
import { groupByBranch, matchingPreset, presetRange } from './timeline';

// Wednesday 18 November 2026, local time.
const now = new Date(2026, 10, 18, 15, 30);

describe('presetRange', () => {
  it('computes ranges with weeks starting on Monday', () => {
    expect(presetRange('last-7', now)).toEqual({ from: '2026-11-11', to: '2026-11-18' });
    expect(presetRange('this-week', now)).toEqual({ from: '2026-11-16', to: '2026-11-22' });
    expect(presetRange('last-week', now)).toEqual({ from: '2026-11-09', to: '2026-11-15' });
    expect(presetRange('last-30', now)).toEqual({ from: '2026-10-19', to: '2026-11-18' });
  });

  it('recognises a preset range', () => {
    expect(matchingPreset({ from: '2026-11-16', to: '2026-11-22' }, now)).toBe('this-week');
    expect(matchingPreset({ from: '2026-11-10', to: '2026-11-17' }, now)).toBeUndefined();
  });
});

describe('groupByBranch', () => {
  it('groups consecutive commits of one project and branch, with their date span', () => {
    const main = { id: 'b1', name: 'main' };
    const feature = { id: 'b2', name: 'feature/cart' };
    const groups = groupByBranch([
      commit({ id: 'c1', branch_id: 'b2', branch: feature, commit_date: '2026-11-16T10:00:00Z' }),
      commit({ id: 'c2', branch_id: 'b2', branch: feature, commit_date: '2026-11-12T10:00:00Z' }),
      commit({ id: 'c3', branch_id: 'b1', branch: main, commit_date: '2026-11-14T10:00:00Z' }),
    ]);
    expect(groups.map((g) => [g.branch.name, g.commits.map((c) => c.id), g.first, g.last])).toEqual([
      ['feature/cart', ['c1', 'c2'], '2026-11-12T10:00:00Z', '2026-11-16T10:00:00Z'],
      ['main', ['c3'], '2026-11-14T10:00:00Z', '2026-11-14T10:00:00Z'],
    ]);
  });
});
