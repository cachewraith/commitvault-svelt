import type { components } from '$lib/api/schema';

type Schemas = components['schemas'];

/** Includes `deployment_count`, `latest_deployment` and `latest_successful_deployment`. */
export type Environment = Schemas['EnvironmentResponse'];
export type EnvironmentRef = Schemas['EnvironmentRef'];
/** The essentials of one recorded deployment (embedded in environments and comparisons). */
export type DeploymentBrief = Schemas['DeploymentBrief'];
export type CreateEnvironmentInput = Schemas['CreateEnvironmentRequest'];
export type UpdateEnvironmentInput = Schemas['UpdateEnvironmentRequest'];
export type EnvironmentSort = Schemas['EnvironmentSort'];
