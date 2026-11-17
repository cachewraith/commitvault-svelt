import type { components } from '$lib/api/schema';
import type { RichTextDoc } from '$lib/types';

type Schemas = components['schemas'];

/** List item: excerpt only, no document body. */
export type Note = Schemas['NoteResponse'];
/** Detail: adds the Tiptap document. */
export type NoteDetail = Omit<Schemas['NoteDetailResponse'], 'content_json'> & { content_json: RichTextDoc };
export type NoteCategory = Schemas['NoteCategory'];
export type NoteSort = Schemas['NoteSort'];
export type CreateNoteInput = Omit<Schemas['CreateNoteRequest'], 'content_json'> & {
  content_json?: RichTextDoc | null;
};
export type UpdateNoteInput = Omit<Schemas['UpdateNoteRequest'], 'content_json'> & {
  content_json?: RichTextDoc | null;
};
