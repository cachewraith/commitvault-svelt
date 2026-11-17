import { z } from 'zod';
import { branchName, optionalHttpUrl, optionalText, requiredText } from '$lib/validators';

/** Backend limit for project slugs (kebab-case, at most 140 characters). */
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const slugMessage = 'Use lowercase letters, digits and single hyphens.';

const baseFields = {
  name: requiredText('Name', 120),
  description: optionalText('Description', 5000),
  repository_url: optionalHttpUrl('Repository URL'),
  default_branch: branchName,
  tag_ids: z.array(z.string()),
};

/** New project: a blank slug lets the server derive one from the name. */
export const projectCreateSchema = z.object({
  ...baseFields,
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(140, 'Slug must be at most 140 characters.')
    .refine((value) => value === '' || slugPattern.test(value), slugMessage)
    .transform((value) => (value === '' ? undefined : value)),
});

/** Existing project: the slug is required. */
export const projectUpdateSchema = z.object({
  ...baseFields,
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Slug is required.')
    .max(140, 'Slug must be at most 140 characters.')
    .regex(slugPattern, slugMessage),
});

export type ProjectCreateData = z.infer<typeof projectCreateSchema>;
export type ProjectUpdateData = z.infer<typeof projectUpdateSchema>;
