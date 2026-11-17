/**
 * Convert free text into a URL-safe slug: lowercase ASCII letters, digits and
 * single hyphens. Mirrors the backend's slug rules so previews match.
 */
export function slugify(input: string, maxLength = 64): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}
