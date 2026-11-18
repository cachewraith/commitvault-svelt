/**
 * Date-range view helpers: preset ranges (weeks start on Monday) and
 * grouping commits under their branch.
 */
import { endOfLocalDayIso, startOfLocalDayIso, toDate, toDateInputValue } from '$lib/utils/format';
import type { Commit } from './types';

export interface DayRange {
  /** Local calendar days, `YYYY-MM-DD`, inclusive. */
  from: string;
  to: string;
}

export const RANGE_PRESETS = ['last-7', 'this-week', 'last-week', 'last-30'] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export const PRESET_LABELS: Record<RangePreset, string> = {
  'last-7': 'Last 7 days',
  'this-week': 'This week',
  'last-week': 'Last week',
  'last-30': 'Last 30 days',
};

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Monday of the week containing `date` (local time). */
function startOfWeek(date: Date): Date {
  const day = (date.getDay() + 6) % 7; // Monday = 0
  return addDays(new Date(date.getFullYear(), date.getMonth(), date.getDate()), -day);
}

export function presetRange(preset: RangePreset, now: Date = new Date()): DayRange {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = (date: Date) => toDateInputValue(date);
  switch (preset) {
    case 'last-7':
      return { from: day(addDays(today, -7)), to: day(today) };
    case 'this-week':
      return { from: day(startOfWeek(today)), to: day(addDays(startOfWeek(today), 6)) };
    case 'last-week': {
      const start = addDays(startOfWeek(today), -7);
      return { from: day(start), to: day(addDays(start, 6)) };
    }
    case 'last-30':
      return { from: day(addDays(today, -30)), to: day(today) };
  }
}

/** The preset a range corresponds to, if any (to highlight its button). */
export function matchingPreset(range: DayRange, now: Date = new Date()): RangePreset | undefined {
  return RANGE_PRESETS.find((preset) => {
    const candidate = presetRange(preset, now);
    return candidate.from === range.from && candidate.to === range.to;
  });
}

/** API bounds for a day range: start of the first day to end of the last (local time). */
export function rangeBounds(range: DayRange): { date_from?: string; date_to?: string } {
  return {
    date_from: startOfLocalDayIso(range.from) ?? undefined,
    date_to: endOfLocalDayIso(range.to) ?? undefined,
  };
}

export interface BranchGroup {
  key: string;
  branch: Commit['branch'];
  project: Commit['project'];
  commits: Commit[];
  /** Earliest and latest commit date in the group. */
  first: string;
  last: string;
}

/**
 * Groups consecutive commits of the same project and branch. The API sorts
 * by project, branch and newest commit first (`sort=branch_name`), so each
 * group arrives contiguous; a group cut by the page size continues on the
 * next page.
 */
export function groupByBranch(commits: readonly Commit[]): BranchGroup[] {
  const groups: BranchGroup[] = [];
  for (const commit of commits) {
    const key = `${commit.project_id}/${commit.branch_id}`;
    let group = groups.at(-1);
    if (!group || group.key !== key) {
      group = { key, branch: commit.branch, project: commit.project, commits: [], first: commit.commit_date, last: commit.commit_date };
      groups.push(group);
    }
    group.commits.push(commit);
    const date = toDate(commit.commit_date)?.getTime() ?? 0;
    if (date < (toDate(group.first)?.getTime() ?? Infinity)) group.first = commit.commit_date;
    if (date > (toDate(group.last)?.getTime() ?? -Infinity)) group.last = commit.commit_date;
  }
  return groups;
}
