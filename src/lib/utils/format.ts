/** Date/time formatting helpers. All inputs are RFC 3339 strings or Date objects. */

export type DateInput = string | number | Date | null | undefined;

/**
 * Day-month-year everywhere (`17 Nov 2026`, 24-hour times), whatever the
 * browser's locale — one unambiguous format across the app.
 */
export const DATE_LOCALE = 'en-GB';

const dateFormatter = new Intl.DateTimeFormat(DATE_LOCALE, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat(DATE_LOCALE, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const timeFormatter = new Intl.DateTimeFormat(DATE_LOCALE, { hour: '2-digit', minute: '2-digit' });

const fullFormatter = new Intl.DateTimeFormat(DATE_LOCALE, {
  dateStyle: 'full',
  timeStyle: 'long',
});

const relativeFormatter = new Intl.RelativeTimeFormat(DATE_LOCALE, { numeric: 'auto' });

/** Parse to a valid Date, or `null` when the input is missing or unparseable. */
export function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `17 Nov 2026` */
export function formatDate(value: DateInput, fallback = '—'): string {
  const date = toDate(value);
  return date ? dateFormatter.format(date) : fallback;
}

/** `17 Nov 2026, 14:14` */
export function formatDateTime(value: DateInput, fallback = '—'): string {
  const date = toDate(value);
  return date ? dateTimeFormatter.format(date) : fallback;
}

/** `14:14` */
export function formatTime(value: DateInput, fallback = '—'): string {
  const date = toDate(value);
  return date ? timeFormatter.format(date) : fallback;
}

/** `10 Nov 2026 → 17 Nov 2026`; an open end reads `since …` / `until …`. */
export function formatDateRange(from: DateInput, to: DateInput, fallback = 'Any time'): string {
  const start = toDate(from);
  const end = toDate(to);
  if (start && end) return `${dateFormatter.format(start)} → ${dateFormatter.format(end)}`;
  if (start) return `since ${dateFormatter.format(start)}`;
  if (end) return `until ${dateFormatter.format(end)}`;
  return fallback;
}

/** Long unambiguous form with weekday and time zone; used for `title` tooltips. */
export function formatFull(value: DateInput, fallback = ''): string {
  const date = toDate(value);
  return date ? fullFormatter.format(date) : fallback;
}

const RELATIVE_STEPS: Array<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
  { unit: 'year', seconds: 365 * 24 * 3600 },
  { unit: 'month', seconds: 30 * 24 * 3600 },
  { unit: 'week', seconds: 7 * 24 * 3600 },
  { unit: 'day', seconds: 24 * 3600 },
  { unit: 'hour', seconds: 3600 },
  { unit: 'minute', seconds: 60 },
];

/** `3 hours ago`, `yesterday`, `in 2 days`, `just now`. */
export function formatRelative(value: DateInput, now: Date = new Date(), fallback = '—'): string {
  const date = toDate(value);
  if (!date) return fallback;
  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSeconds);
  if (abs < 45) return 'just now';
  for (const step of RELATIVE_STEPS) {
    if (abs >= step.seconds) {
      return relativeFormatter.format(Math.round(diffSeconds / step.seconds), step.unit);
    }
  }
  return relativeFormatter.format(Math.round(diffSeconds / 60), 'minute');
}

/** Local calendar day (`YYYY-MM-DD`) for a date; used by `<input type="date">`. */
export function toDateInputValue(value: DateInput): string {
  const date = toDate(value);
  if (!date) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local `YYYY-MM-DDTHH:mm` for `<input type="datetime-local">`. */
export function toDateTimeInputValue(value: DateInput): string {
  const date = toDate(value);
  if (!date) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${toDateInputValue(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Convert a `datetime-local` input value (local time) to an RFC 3339 UTC string. */
export function fromDateTimeInputValue(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** RFC 3339 UTC instant for 00:00:00.000 local time on the given `YYYY-MM-DD` day. */
export function startOfLocalDayIso(day: string): string | null {
  const parts = parseDay(day);
  if (!parts) return null;
  return new Date(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0).toISOString();
}

/** RFC 3339 UTC instant for 23:59:59.999 local time on the given `YYYY-MM-DD` day. */
export function endOfLocalDayIso(day: string): string | null {
  const parts = parseDay(day);
  if (!parts) return null;
  return new Date(parts.year, parts.month - 1, parts.day, 23, 59, 59, 999).toISOString();
}

function parseDay(day: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return null;
  const [, y, m, d] = match;
  return { year: Number(y), month: Number(m), day: Number(d) };
}

const numberFormatter = new Intl.NumberFormat();

/** `12,480` */
export function formatNumber(value: number | null | undefined, fallback = '—'): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? numberFormatter.format(value)
    : fallback;
}

/** `1 commit`, `3 commits`. */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}
