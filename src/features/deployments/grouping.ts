import { DATE_LOCALE, toDate, toDateInputValue } from '$lib/utils/format';

export interface DayGroup<T> {
  /** Local calendar day, `YYYY-MM-DD`. */
  day: string;
  /** Heading: "Today", "Yesterday" or a full date. */
  label: string;
  items: T[];
}

const dayFormatter = new Intl.DateTimeFormat(DATE_LOCALE, {
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
 * Groups records by the **local** calendar day of `deployed_at`. Groups appear
 * in the order their first record arrives and keep the incoming order inside;
 * a day never appears twice, even if the input is not sorted by date (e.g.
 * the previous page shown while a newly sorted one loads).
 */
export function groupByDay<T extends { deployed_at: string }>(records: readonly T[], now: Date = new Date()): DayGroup<T>[] {
  const groups = new Map<string, DayGroup<T>>();
  for (const record of records) {
    const day = toDateInputValue(toDate(record.deployed_at));
    const group = groups.get(day);
    if (group) {
      group.items.push(record);
    } else {
      groups.set(day, { day, label: day ? dayLabel(day, now) : 'Unknown date', items: [record] });
    }
  }
  return [...groups.values()];
}
