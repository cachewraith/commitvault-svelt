import type { components } from '$lib/api/schema';

type Schemas = components['schemas'];

/** A branch with its commit count and latest commit date. */
export type Branch = Schemas['BranchResponse'];
/** A branch plus, per environment, the latest deployment record of one of its commits. */
export type BranchDetail = Schemas['BranchDetailResponse'];
export type BranchEnvironment = Schemas['BranchEnvironment'];
export type BranchSort = Schemas['BranchSort'];
export type CreateBranchInput = Schemas['CreateBranchRequest'];
export type UpdateBranchInput = Schemas['UpdateBranchRequest'];
