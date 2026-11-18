import { api } from '$lib/api/client';
import type { ListParams } from '$lib/api/types';
import type {
  Commit,
  CommitDeploymentFilter,
  CommitSort,
  CreateCommitInput,
  UpdateCommitInput,
} from './types';

export interface CommitListParams extends ListParams {
  project_id?: string;
  /** Commits of this branch. */
  branch_id?: string;
  /** Hash prefix. */
  hash?: string;
  /** RFC 3339, inclusive. */
  date_from?: string;
  date_to?: string;
  deployment_status?: CommitDeploymentFilter;
  /** Scope `deployment_status` to one environment; alone = "has a record there". */
  environment_id?: string;
  tag_id?: string;
  release_id?: string;
  sort?: CommitSort;
}

export const commitsApi = {
  /** Commits across projects; pass `project_id` to scope. `search` matches message, branch, author and hash prefix. */
  list: (params: CommitListParams = {}, signal?: AbortSignal) =>
    api.list<Commit>('/commits', { query: params, signal }),
  get: (id: string, signal?: AbortSignal) => api.get<Commit>(`/commits/${id}`, { signal }),
  create: (projectId: string, input: CreateCommitInput) =>
    api.post<Commit>(`/projects/${projectId}/commits`, input),
  update: (id: string, input: UpdateCommitInput) => api.patch<Commit>(`/commits/${id}`, input),
  /**
   * Fails with 409 when the commit has deployment records unless `cascade`
   * is set, in which case those records are deleted too.
   */
  remove: (id: string, options: { cascade?: boolean } = {}) =>
    api.del(`/commits/${id}`, { query: { cascade: options.cascade || undefined } }),
};
