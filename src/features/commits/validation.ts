/**
 * Commit form rules. Limits mirror the backend (`commits/dto.rs`,
 * `shared/validation.rs`); the server remains the source of truth.
 */
import { z } from 'zod';
import { fromDateTimeInputValue } from '$lib/utils/format';
import { branchName, commitHash, optionalHttpUrl, optionalText, requiredText } from '$lib/validators';

/** Git also refuses these shapes; the backend rejects them with a 422. */
const gitBranchName = branchName.refine(
  (value) => !value.includes('..') && !value.startsWith('/') && !value.endsWith('/') && !value.endsWith('.'),
  'Branch names cannot contain "..", start or end with "/", or end with ".".',
);

/** `<input type="datetime-local">` value → RFC 3339 UTC instant. */
export const localDateTime = (label: string) =>
  z
    .string()
    .min(1, `${label} is required.`)
    .refine((value) => fromDateTimeInputValue(value) !== null, `${label} is not a valid date and time.`)
    .transform((value) => fromDateTimeInputValue(value) as string);

export const commitFormSchema = z.object({
  project_id: z.string().min(1, 'Choose a project.'),
  branch_name: gitBranchName,
  commit_hash: commitHash,
  commit_message: requiredText('Message', 2000),
  commit_date: localDateTime('Commit date'),
  author_name: optionalText('Author', 200),
  external_url: optionalHttpUrl('Link'),
  description: optionalText('Description', 20000),
  tag_ids: z.array(z.string()),
});

export type CommitFormData = z.output<typeof commitFormSchema>;

/**
 * Normalise pasted hash text: drops surrounding whitespace, inner whitespace
 * and case, so `" 9FCEB02 "` copied from a terminal just works.
 */
export function normalizeHashInput(raw: string): string {
  return raw.replace(/\s+/g, '').toLowerCase();
}
