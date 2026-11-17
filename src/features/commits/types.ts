import type { components } from '$lib/api/schema';

type Schemas = components['schemas'];

/** Includes tags, `deployment_count`, per-environment record summary and releases. */
export type Commit = Schemas['CommitResponse'];
export type CommitBrief = Schemas['CommitBrief'];
/** Deployment records of one commit in one environment. */
export type CommitEnvironment = Schemas['CommitEnvironment'];
export type BranchSummary = Schemas['BranchSummary'];
export type CommitSort = Schemas['CommitSort'];
/** Filter on *recorded* deployments: `none` = no record exists (not "never deployed"). */
export type CommitDeploymentFilter = Schemas['CommitDeploymentFilter'];
export type CreateCommitInput = Schemas['CreateCommitRequest'];
export type UpdateCommitInput = Schemas['UpdateCommitRequest'];

export const COMMIT_DEPLOYMENT_FILTERS = [
  'any',
  'none',
  'successful',
  'failed',
  'rolled_back',
  'pending',
] as const satisfies readonly CommitDeploymentFilter[];
