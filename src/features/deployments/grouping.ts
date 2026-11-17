import { toDate, toDateInputValue } from '$lib/utils/format';

export interface DayGroup<T> {
  /** Local calendar day, `YYYY-MM-DD`. */
  day: string;
  /** Heading: "Today", "Yesterday" or a full date. */
  label: string;
  items: T[];
}

const dayFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

function dayLabel(day: string, now: Date): string {
  if (day === toDateInputValue(now)) return 'Today';
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (day === toDateInputValue(yesterday)) return 'Yesterday';
  const [year, month, date] = day.split('-').map(Number);
  return dayFormatter.format(new Date(year!, month! - 1, date!));
}

/**
 * Groups records by the **local** calendar day of `deployed_at`, keeping the
 * incoming order (the API returns them sorted), so consecutive records of the
 * same day share one heading.
 */
export function groupByDay<T extends { deployed_at: string }>(records: readonly T[], now: Date = new Date()): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const record of records) {
    const day = toDateInputValue(toDate(record.deployed_at));
    const last = groups[groups.length - 1];
    if (last && last.day === day) {
      last.items.push(record);
    } else {
      groups.push({ day, label: day ? dayLabel(day, now) : 'Unknown date', items: [record] });
    }
  }
  return groups;
}
