import type { components } from '$lib/api/schema';

type Schemas = components['schemas'];

/** Includes `usage` counts per record type. */
export type Tag = Schemas['TagResponse'];
/** Tag as embedded in other resources. */
export type TagRef = Schemas['TagRef'];
export type TagUsage = Schemas['TagUsage'];
export type TagSort = Schemas['TagSort'];
export type CreateTagInput = Schemas['CreateTagRequest'];
export type UpdateTagInput = Schemas['UpdateTagRequest'];
