import type { ZodType } from 'zod';
import type { FieldErrors } from '$lib/api/types';

export type ValidationResult<T> =
  | { ok: true; data: T; errors: FieldErrors }
  | { ok: false; data?: undefined; errors: FieldErrors };

/**
 * Validate form values against a Zod schema.
 *
 *   const result = validateForm(schema, values);
 *   if (!result.ok) { errors = result.errors; return; }
 *   await mutation.mutateAsync(result.data);
 *
 * Errors are keyed by the dotted field path (`'name'`, `'links.0.url'`) and
 * hold the first message for each field. Form-level issues use the key `_form`.
 */
export function validateForm<T>(schema: ZodType<T>, values: unknown): ValidationResult<T> {
  const parsed = schema.safeParse(values);
  if (parsed.success) return { ok: true, data: parsed.data, errors: {} };

  const errors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join('.') : '_form';
    errors[key] ??= issue.message;
  }
  return { ok: false, errors };
}
