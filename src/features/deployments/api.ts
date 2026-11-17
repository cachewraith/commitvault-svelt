import { api } from '$lib/api/client';
import type { ListParams } from '$lib/api/types';
import type {
  CreateDeploymentInput,
  Deployment,
  DeploymentSort,
  DeploymentStatus,
  EnvironmentComparison,
  UpdateDeploymentInput,
} from './types';

export interface DeploymentListParams extends ListParams {
  project_id?: string;
  environment_id?: string;
  commit_id?: string;
  status?: DeploymentStatus;
  /** RFC 3339, inclusive. */
  date_from?: string;
  date_to?: string;
  tag_id?: string;
  sort?: DeploymentSort;
}

export interface CompareParams {
  base: string;
  target: string;
  /** Count records of every status instead of only `successful`. */
  include_unsuccessful?: boolean;
}

export const deploymentsApi = {
  /** Deployment records across projects, newest first; pass `project_id` to scope. */
  list: (params: DeploymentListParams = {}, signal?: AbortSignal) =>
    api.list<Deployment>('/deployments', { query: params, signal }),
  get: (id: string, signal?: AbortSignal) => api.get<Deployment>(`/deployments/${id}`, { signal }),
  /** `environment_id` and `commit_id` must belong to `projectId` (422 otherwise). */
  create: (projectId: string, input: CreateDeploymentInput) =>
    api.post<Deployment>(`/projects/${projectId}/deployments`, input),
  update: (id: string, input: UpdateDeploymentInput) => api.patch<Deployment>(`/deployments/${id}`, input),
  remove: (id: string) => api.del(`/deployments/${id}`),
  compare: (projectId: string, params: CompareParams, signal?: AbortSignal) =>
    api.get<EnvironmentComparison>(`/projects/${projectId}/deployments/compare`, {
      query: { ...params, include_unsuccessful: params.include_unsuccessful || undefined },
      signal,
    }),
};
