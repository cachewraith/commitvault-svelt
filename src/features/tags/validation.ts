import { z } from 'zod';
import { hexColor, requiredText } from '$lib/validators';

/** Colours are stored as lower-case `#rrggbb`. */
export const tagColor = hexColor
  .refine((value) => value.length === 7, 'Use the six-digit form, such as #22c55e.')
  .transform((value) => value.toLowerCase());

export const tagFormSchema = z.object({
  name: requiredText('Name', 50),
  color: tagColor,
});

export type TagFormData = z.infer<typeof tagFormSchema>;

/** Neutral grey the backend also uses when no colour is given. */
export const DEFAULT_TAG_COLOR = '#71717a';
