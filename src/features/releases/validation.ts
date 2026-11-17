import { z } from 'zod';
import { RELEASE_STATUSES } from '$lib/types';
import { fromDateTimeInputValue } from '$lib/utils/format';
import { optionalText, requiredText } from '$lib/validators';

/** Limits mirror `CreateReleaseRequest` / `UpdateReleaseRequest` in the backend. */
export const releaseSchema = z.object({
  project_id: z.string().min(1, 'Choose a project.'),
  version: requiredText('Version', 64),
  title: requiredText('Title', 200),
  status: z.enum(RELEASE_STATUSES),
  /** Value of a `datetime-local` input; `''` means "no date". */
  released_at: z
    .string()
    .refine((value) => value === '' || fromDateTimeInputValue(value) !== null, 'Enter a valid date and time.')
    .transform((value) => (value === '' ? null : fromDateTimeInputValue(value))),
  description: optionalText('Description', 5000),
});

export type ReleaseFormValues = z.input<typeof releaseSchema>;

const SEMVER = /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

/** `1.4.0`, `v2.0.0-rc.1`, `1.0.0+build.5`. Used for a non-blocking hint only. */
export function looksLikeSemver(version: string): boolean {
  return SEMVER.test(version.trim());
}
