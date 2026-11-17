import { api } from '$lib/api/client';
import type { ListParams } from '$lib/api/types';
import type { CreateProjectInput, Project, ProjectSort, ProjectStatus, UpdateProjectInput } from './types';

export interface ProjectListParams extends ListParams {
  status?: ProjectStatus;
  tag_id?: string;
  sort?: ProjectSort;
}

export const projectsApi = {
  list: (params: ProjectListParams = {}, signal?: AbortSignal) =>
    api.list<Project>('/projects', { query: params, signal }),
  get: (id: string, signal?: AbortSignal) => api.get<Project>(`/projects/${id}`, { signal }),
  create: (input: CreateProjectInput) => api.post<Project>('/projects', input),
  /** Partial update. `status: 'archived'` archives, `'active'` restores. */
  update: (id: string, input: UpdateProjectInput) => api.patch<Project>(`/projects/${id}`, input),
  /** Deletes the project and everything it owns. */
  remove: (id: string) => api.del(`/projects/${id}`),
};
