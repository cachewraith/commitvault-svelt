/** True when `value` parses as an absolute URL using one of the allowed schemes. */
export function isSafeUrl(
  value: string | null | undefined,
  schemes: readonly string[] = ['http:', 'https:'],
): boolean {
  if (!value) return false;
  try {
    const url = new URL(value.trim());
    return schemes.includes(url.protocol);
  } catch {
    return false;
  }
}

/** Returns the URL when it is http(s); otherwise `undefined` (never render unsafe hrefs). */
export function safeExternalUrl(value: string | null | undefined): string | undefined {
  return value && isSafeUrl(value) ? value.trim() : undefined;
}
