import type { components } from '$lib/api/schema';

type Schemas = components['schemas'];

export type Project = Schemas['ProjectResponse'];
export type ProjectStats = Schemas['ProjectStats'];
export type ProjectRef = Schemas['ProjectRef'];
export type ProjectStatus = Schemas['ProjectStatus'];
export type ProjectSort = Schemas['ProjectSort'];
export type CreateProjectInput = Schemas['CreateProjectRequest'];
export type UpdateProjectInput = Schemas['UpdateProjectRequest'];
