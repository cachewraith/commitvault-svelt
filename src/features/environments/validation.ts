import { z } from 'zod';
import { optionalText, requiredText } from '$lib/validators';
import { tagColor } from '$features/tags/validation';

export const environmentFormSchema = z.object({
  name: requiredText('Name', 80),
  description: optionalText('Description', 2000),
  color: tagColor,
  server_label: optionalText('Server label', 120),
});

export type EnvironmentFormData = z.infer<typeof environmentFormSchema>;

/** Neutral grey the backend also uses when no colour is given. */
export const DEFAULT_ENVIRONMENT_COLOR = '#71717a';

/** Backend limit; the create action is disabled once it is reached. */
export const MAX_ENVIRONMENTS_PER_PROJECT = 50;
