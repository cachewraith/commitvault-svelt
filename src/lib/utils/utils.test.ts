import { describe, expect, it, vi } from 'vitest';
import {
  debounce,
  endOfLocalDayIso,
  formatDate,
  formatRelative,
  isCommitHash,
  isHexColor,
  isSafeUrl,
  pluralize,
  safeExternalUrl,
  safeHexColor,
  shortHash,
  slugify,
  startOfLocalDayIso,
  toDate,
  toDateInputValue,
} from './index';

describe('format', () => {
  const now = new Date('2026-11-17T12:00:00Z');

  it('formats relative times in both directions', () => {
    expect(formatRelative('2026-11-17T11:59:40Z', now)).toBe('just now');
    expect(formatRelative('2026-11-17T11:30:00Z', now)).toBe('30 minutes ago');
    expect(formatRelative('2026-11-17T09:00:00Z', now)).toBe('3 hours ago');
    expect(formatRelative('2026-11-16T12:00:00Z', now)).toBe('yesterday');
    expect(formatRelative('2026-11-19T12:00:00Z', now)).toBe('in 2 days');
    expect(formatRelative('2026-08-17T12:00:00Z', now)).toBe('3 months ago');
  });

  it('returns fallbacks for missing or invalid dates', () => {
    expect(formatRelative(null, now)).toBe('—');
    expect(formatDate('not a date')).toBe('—');
    expect(formatDate(undefined, 'never')).toBe('never');
    expect(toDate('')).toBeNull();
    expect(toDate('2026-11-17T12:00:00Z')?.toISOString()).toBe('2026-11-17T12:00:00.000Z');
  });

  it('converts local days to inclusive ISO boundaries', () => {
    const start = startOfLocalDayIso('2026-11-17')!;
    const end = endOfLocalDayIso('2026-11-17')!;

    expect(new Date(start).getHours()).toBe(0);
    expect(new Date(end).getHours()).toBe(23);
    expect(new Date(end).getTime() - new Date(start).getTime()).toBe(24 * 3600 * 1000 - 1);
    expect(toDateInputValue(start)).toBe('2026-11-17');
    expect(toDateInputValue(end)).toBe('2026-11-17');
    expect(startOfLocalDayIso('17/11/2026')).toBeNull();
    expect(endOfLocalDayIso('')).toBeNull();
  });

  it('pluralises counts', () => {
    expect(pluralize(1, 'commit')).toBe('1 commit');
    expect(pluralize(0, 'commit')).toBe('0 commits');
    expect(pluralize(2, 'entry', 'entries')).toBe('2 entries');
  });
});

describe('hash', () => {
  it('abbreviates hashes', () => {
    expect(shortHash('9fceb02d0ae598e95dc970b74767f19372d61af8')).toBe('9fceb02');
    expect(shortHash('9fceb02d0ae5', 10)).toBe('9fceb02d0a');
    expect(shortHash(null)).toBe('');
  });

  it('validates commit hashes', () => {
    expect(isCommitHash('9fceb02')).toBe(true);
    expect(isCommitHash('9FCEB02D0AE598E95DC970B74767F19372D61AF8')).toBe(true);
    expect(isCommitHash('9fceb0')).toBe(false);
    expect(isCommitHash('9fceb0z')).toBe(false);
    expect(isCommitHash('a'.repeat(65))).toBe(false);
  });
});

describe('slugify', () => {
  it('produces URL-safe slugs', () => {
    expect(slugify('  Dev Server (EU) ')).toBe('dev-server-eu');
    expect(slugify('Crème Brûlée API')).toBe('creme-brulee-api');
    expect(slugify('--a--b--')).toBe('a-b');
    expect(slugify('!!!')).toBe('');
    expect(slugify('abc def ghi', 7)).toBe('abc-def');
  });
});

describe('color and url guards', () => {
  it('accepts only hex colours', () => {
    expect(isHexColor('#22c55e')).toBe(true);
    expect(isHexColor('#abc')).toBe(true);
    expect(isHexColor('red')).toBe(false);
    expect(isHexColor('#22c55e; background:url(x)')).toBe(false);
    expect(safeHexColor('url(javascript:alert(1))')).toBe('#71717a');
    expect(safeHexColor(null, '#000000')).toBe('#000000');
  });

  it('accepts only http(s) URLs for external links', () => {
    expect(isSafeUrl('https://github.com/org/repo/commit/abc')).toBe(true);
    expect(isSafeUrl('http://localhost:3000')).toBe(true);
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('data:text/html,x')).toBe(false);
    expect(isSafeUrl('/relative')).toBe(false);
    expect(safeExternalUrl(' https://example.com ')).toBe('https://example.com');
    expect(safeExternalUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeExternalUrl(null)).toBeUndefined();
  });
});

describe('debounce', () => {
  it('runs once after the delay with the latest arguments', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced('a');
    debounced('b');
    vi.advanceTimersByTime(199);
    expect(fn).not.toHaveBeenCalled();
    expect(debounced.pending()).toBe(true);

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledExactlyOnceWith('b');
    expect(debounced.pending()).toBe(false);
  });

  it('supports cancel and flush', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced('a');
    debounced.cancel();
    vi.advanceTimersByTime(500);
    expect(fn).not.toHaveBeenCalled();

    debounced('b');
    debounced.flush();
    expect(fn).toHaveBeenCalledExactlyOnceWith('b');
    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
