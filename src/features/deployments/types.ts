import type { components } from '$lib/api/schema';

type Schemas = components['schemas'];

/** One recorded deployment event with its project, environment, commit and tags. */
export type Deployment = Schemas['DeploymentResponse'];
export type DeploymentStatus = Schemas['DeploymentStatus'];
export type DeploymentSort = Schemas['DeploymentSort'];
export type CreateDeploymentInput = Schemas['CreateDeploymentRequest'];
export type UpdateDeploymentInput = Schemas['UpdateDeploymentRequest'];

/**
 * Comparison of the deployment *records* of two environments. It never states
 * that a commit is absent from an environment or that one is ahead/behind —
 * always show `notice` next to the result.
 */
export type EnvironmentComparison = Schemas['EnvironmentComparison'];
export type ComparisonSide = Schemas['ComparisonSide'];
export type ComparisonCounts = Schemas['ComparisonCounts'];
export type ComparedCommit = Schemas['ComparedCommit'];
export type SharedCommit = Schemas['SharedCommit'];
