/** Abbreviate a commit hash for display (first 7 characters by default). */
export function shortHash(hash: string | null | undefined, length = 7): string {
  if (!hash) return '';
  return hash.trim().slice(0, length);
}

const HASH_PATTERN = /^[0-9a-f]{7,64}$/i;

/** True for a plausible full or abbreviated Git object id (7–64 hex characters). */
export function isCommitHash(value: string): boolean {
  return HASH_PATTERN.test(value.trim());
}
