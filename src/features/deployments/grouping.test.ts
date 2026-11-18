import { describe, expect, it } from 'vitest';
import { groupByDay } from './grouping';

/** A local-time instant, as an ISO string like the API returns. */
const at = (year: number, month: number, day: number, hour: number) =>
  new Date(year, month - 1, day, hour, 0, 0).toISOString();

describe('groupByDay', () => {
  const now = new Date(2026, 2, 10, 15, 0, 0); // 10 March 2026, local time

  it('returns no groups for no records', () => {
    expect(groupByDay([], now)).toEqual([]);
  });

  it('groups consecutive records by local calendar day and keeps the incoming order', () => {
    const records = [
      { id: 'a', deployed_at: at(2026, 3, 10, 14) },
      { id: 'b', deployed_at: at(2026, 3, 10, 0) },
      { id: 'c', deployed_at: at(2026, 3, 9, 23) },
      { id: 'd', deployed_at: at(2026, 2, 27, 9) },
      { id: 'e', deployed_at: at(2026, 2, 27, 8) },
    ];
    const groups = groupByDay(records, now);

    expect(groups.map((group) => group.day)).toEqual(['2026-03-10', '2026-03-09', '2026-02-27']);
    expect(groups.map((group) => group.items.map((item) => item.id))).toEqual([['a', 'b'], ['c'], ['d', 'e']]);
  });

  it('labels today and yesterday, and spells out older days', () => {
    const groups = groupByDay(
      [
        { deployed_at: at(2026, 3, 10, 9) },
        { deployed_at: at(2026, 3, 9, 9) },
        { deployed_at: at(2026, 3, 1, 9) },
      ],
      now,
    );
    expect(groups[0]!.label).toBe('Today');
    expect(groups[1]!.label).toBe('Yesterday');
    expect(groups[2]!.label).toContain('2026');
    expect(groups[2]!.label).not.toBe('Today');
  });

  it('splits on the local day boundary, not the UTC one', () => {
    // 23:30 and 00:30 local time are different days whatever the UTC offset is.
    const late = new Date(2026, 2, 9, 23, 30).toISOString();
    const early = new Date(2026, 2, 10, 0, 30).toISOString();
    const groups = groupByDay([{ deployed_at: early }, { deployed_at: late }], now);
    expect(groups.map((group) => group.day)).toEqual(['2026-03-10', '2026-03-09']);
  });

  it('never repeats a day when the input is not in date order', () => {
    const now = new Date(2026, 10, 18, 12);
    const at = (day: number, hour: number) => ({ deployed_at: new Date(2026, 10, day, hour).toISOString() });
    const groups = groupByDay([at(17, 9), at(16, 9), at(17, 15)], now);
    expect(groups.map((group) => [group.label, group.items.length])).toEqual([
      ['Yesterday', 2],
      [groups[1]!.label, 1],
    ]);
    expect(new Set(groups.map((group) => group.day)).size).toBe(groups.length);
  });
});
