import { api } from '$lib/api/client';
import type { ListParams } from '$lib/api/types';
import type { CreateNoteInput, Note, NoteCategory, NoteDetail, NoteSort, UpdateNoteInput } from './types';

export interface NoteListParams extends ListParams {
  project_id?: string;
  /** `true` = only global notes (no project). */
  global?: boolean;
  /** Exact category. */
  category?: string;
  pinned?: boolean;
  tag_id?: string;
  sort?: NoteSort;
}

export const notesApi = {
  /** Pinned notes first. `search` also matches the note text. No document bodies. */
  list: (params: NoteListParams = {}, signal?: AbortSignal) => api.list<Note>('/notes', { query: params, signal }),
  get: (id: string, signal?: AbortSignal) => api.get<NoteDetail>(`/notes/${id}`, { signal }),
  /** Omit `project_id` for a global note. */
  create: (input: CreateNoteInput) => api.post<NoteDetail>('/notes', input),
  /** Partial update — also the autosave call. `project_id: null` makes the note global. */
  update: (id: string, input: UpdateNoteInput) => api.patch<NoteDetail>(`/notes/${id}`, input),
  remove: (id: string) => api.del(`/notes/${id}`),
  /** Categories in use, most used first (max 200). */
  categories: (params: { project_id?: string } = {}, signal?: AbortSignal) =>
    api.get<NoteCategory[]>('/notes/categories', { query: params, signal }),
};
