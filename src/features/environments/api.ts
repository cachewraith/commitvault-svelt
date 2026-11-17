import { api } from '$lib/api/client';
import type { ListParams } from '$lib/api/types';
import type { CreateEnvironmentInput, Environment, UpdateEnvironmentInput } from './types';

export interface EnvironmentListParams extends Pick<ListParams, 'page' | 'per_page' | 'search'> {
  project_id?: string;
}

export const environmentsApi = {
  /** Environments across projects (paginated). */
  list: (params: EnvironmentListParams = {}, signal?: AbortSignal) =>
    api.list<Environment>('/environments', { query: params, signal }),
  /** All environments of a project in display order (not paginated; max 50). */
  listForProject: (projectId: string, signal?: AbortSignal) =>
    api.get<Environment[]>(`/projects/${projectId}/environments`, { signal }),
  get: (id: string, signal?: AbortSignal) => api.get<Environment>(`/environments/${id}`, { signal }),
  create: (projectId: string, input: CreateEnvironmentInput) =>
    api.post<Environment>(`/projects/${projectId}/environments`, input),
  update: (id: string, input: UpdateEnvironmentInput) => api.patch<Environment>(`/environments/${id}`, input),
  /** `environmentIds` must contain every environment of the project exactly once. */
  reorder: (projectId: string, environmentIds: string[]) =>
    api.put<Environment[]>(`/projects/${projectId}/environments/order`, { environment_ids: environmentIds }),
  /**
   * Fails with 409 when the environment has deployment records unless
   * `cascade` is set, in which case those records are deleted too.
   */
  remove: (id: string, options: { cascade?: boolean } = {}) =>
    api.del(`/environments/${id}`, { query: { cascade: options.cascade || undefined } }),
};
