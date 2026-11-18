/**
 * Branch form rules. Limits mirror the backend (`branches/dto.rs`,
 * `shared/validation.rs`); the server remains the source of truth.
 */
import { z } from 'zod';
import { branchName, optionalText } from '$lib/validators';

/** Git also refuses these shapes; the backend rejects them with a 422. */
export const gitBranchName = branchName.refine(
  (value) => !value.includes('..') && !value.startsWith('/') && !value.endsWith('/') && !value.endsWith('.'),
  'Branch names cannot contain "..", start or end with "/", or end with ".".',
);

export const branchFormSchema = z.object({
  name: gitBranchName,
  description: optionalText('Description', 2000),
});

export type BranchFormData = z.output<typeof branchFormSchema>;
