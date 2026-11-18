import { api } from '$lib/api/client';
import type { ListParams } from '$lib/api/types';
import type { Branch, BranchDetail, BranchSort, CreateBranchInput, UpdateBranchInput } from './types';

export interface BranchListParams extends ListParams {
  /** Default: most recent commit first. */
  sort?: BranchSort;
}

export const branchesApi = {
  /** Branches of one project; `search` matches the name. */
  list: (projectId: string, params: BranchListParams = {}, signal?: AbortSignal) =>
    api.list<Branch>(`/projects/${projectId}/branches`, { query: params, signal }),
  get: (id: string, signal?: AbortSignal) => api.get<BranchDetail>(`/branches/${id}`, { signal }),
  create: (projectId: string, input: CreateBranchInput) =>
    api.post<Branch>(`/projects/${projectId}/branches`, input),
  /** Renaming moves every commit of the branch with it. */
  update: (id: string, input: UpdateBranchInput) => api.patch<Branch>(`/branches/${id}`, input),
  /**
   * Fails with 409 while the branch has commits unless `cascade` is set, in
   * which case its commits and their deployment records are deleted too.
   */
  remove: (id: string, options: { cascade?: boolean } = {}) =>
    api.del(`/branches/${id}`, { query: { cascade: options.cascade || undefined } }),
};
