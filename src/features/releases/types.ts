import type { components } from '$lib/api/schema';
import type { RichTextDoc } from '$lib/types';

type Schemas = components['schemas'];

/** The generated schema types JSON documents as opaque objects; the app knows they are Tiptap docs. */
type WithNotes<T> = Omit<T, 'release_notes'> & { release_notes?: RichTextDoc | null };

/** List item: no notes, no commits (`commit_count` only). */
export type Release = Schemas['ReleaseResponse'];
/** Detail: adds `release_notes` and `commits`. */
export type ReleaseDetail = WithNotes<Schemas['ReleaseDetailResponse']>;
export type ReleaseRef = Schemas['ReleaseRef'];
export type ReleaseStatus = Schemas['ReleaseStatus'];
export type ReleaseSort = Schemas['ReleaseSort'];
export type CreateReleaseInput = WithNotes<Schemas['CreateReleaseRequest']>;
export type UpdateReleaseInput = WithNotes<Schemas['UpdateReleaseRequest']>;
