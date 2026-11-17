import { z } from 'zod';
import { optionalText, requiredText } from '$lib/validators';

export const NOTE_TITLE_MAX = 200;
export const NOTE_CATEGORY_MAX = 60;

/** Limits mirror `CreateNoteRequest` / `UpdateNoteRequest` in the backend. */
export const noteMetaSchema = z.object({
  title: requiredText('Title', NOTE_TITLE_MAX),
  category: optionalText('Category', NOTE_CATEGORY_MAX),
});

/** Error message for a title, or `null` when it can be saved. */
export function titleError(title: string): string | null {
  const result = noteMetaSchema.shape.title.safeParse(title);
  return result.success ? null : (result.error.issues[0]?.message ?? 'Title is invalid.');
}

/** Error message for a category, or `null` when it can be saved. */
export function categoryError(category: string): string | null {
  const result = noteMetaSchema.shape.category.safeParse(category);
  return result.success ? null : (result.error.issues[0]?.message ?? 'Category is invalid.');
}
