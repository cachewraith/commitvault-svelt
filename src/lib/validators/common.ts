/**
 * Reusable Zod building blocks. Limits mirror the backend's validation so the
 * user gets immediate feedback; the server remains the source of truth.
 */
import { z } from 'zod';
import { isCommitHash } from '$lib/utils/hash';
import { isHexColor } from '$lib/utils/color';
import { isSafeUrl } from '$lib/utils/url';

/** Required, trimmed text. */
export const requiredText = (label: string, max = 200) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be at most ${max} characters.`);

/** Optional, trimmed text; `''` becomes `null` (clears the field on PATCH). */
export const optionalText = (label: string, max = 2000) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters.`)
    .transform((value) => (value === '' ? null : value))
    .nullable();

/** Optional http(s) URL; `''` becomes `null`. */
export const optionalHttpUrl = (label = 'URL', max = 2048) =>
  z
    .string()
    .trim()
    .max(max, `${label} is too long.`)
    .refine((value) => value === '' || isSafeUrl(value), `${label} must start with http:// or https://.`)
    .transform((value) => (value === '' ? null : value))
    .nullable();

export const email = z
  .string()
  .trim()
  .min(1, 'Email is required.')
  .max(254, 'Email is too long.')
  .pipe(z.email('Enter a valid email address.'));

export const hexColor = z
  .string()
  .trim()
  .refine(isHexColor, 'Use a hex colour such as #22c55e.');

/** Full or abbreviated Git hash (7–64 hex characters), normalised to lowercase. */
export const commitHash = z
  .string()
  .trim()
  .min(1, 'Commit hash is required.')
  .refine(isCommitHash, 'Enter 7–64 hexadecimal characters.')
  .transform((value) => value.toLowerCase());

export const slug = z
  .string()
  .trim()
  .min(1, 'Slug is required.')
  .max(64, 'Slug must be at most 64 characters.')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, digits and single hyphens.');

/** Git branch name: no whitespace or control characters. */
export const branchName = z
  .string()
  .trim()
  .min(1, 'Branch is required.')
  .max(255, 'Branch must be at most 255 characters.')
  .regex(/^[^\s~^:?*[\\]+$/, 'Branch names cannot contain spaces or ~ ^ : ? * [ \\.');

export const uuid = z.uuid('Invalid identifier.');
