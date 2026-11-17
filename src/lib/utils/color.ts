const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** True for `#rgb` or `#rrggbb`. */
export function isHexColor(value: string | null | undefined): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value);
}

/**
 * Return the colour only if it is a plain hex value; otherwise the fallback.
 * User-supplied colours are placed in inline styles, so anything that is not a
 * strict hex literal is discarded.
 */
export function safeHexColor(value: string | null | undefined, fallback = '#71717a'): string {
  return isHexColor(value) ? value : fallback;
}

/** Curated swatches offered when picking environment/tag colours. */
export const COLOR_SWATCHES = [
  '#71717a',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#a855f7',
  '#ec4899',
] as const;
