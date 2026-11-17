import { api } from '$lib/api/client';
import type { ListParams } from '$lib/api/types';
import type {
  CreateReleaseInput,
  Release,
  ReleaseDetail,
  ReleaseSort,
  ReleaseStatus,
  UpdateReleaseInput,
} from './types';

export interface ReleaseListParams extends ListParams {
  project_id?: string;
  status?: ReleaseStatus;
  tag_id?: string;
  /** Releases that include this commit. */
  commit_id?: string;
  sort?: ReleaseSort;
}

export const releasesApi = {
  /** Releases across projects (unreleased first, then newest); pass `project_id` to scope. */
  list: (params: ReleaseListParams = {}, signal?: AbortSignal) =>
    api.list<Release>('/releases', { query: params, signal }),
  get: (id: string, signal?: AbortSignal) => api.get<ReleaseDetail>(`/releases/${id}`, { signal }),
  /** `commit_ids` must be commits of `projectId`. */
  create: (projectId: string, input: CreateReleaseInput) =>
    api.post<ReleaseDetail>(`/projects/${projectId}/releases`, input),
  /** `commit_ids` / `tag_ids`, when present, replace the current sets. */
  update: (id: string, input: UpdateReleaseInput) => api.patch<ReleaseDetail>(`/releases/${id}`, input),
  remove: (id: string) => api.del(`/releases/${id}`),
};
