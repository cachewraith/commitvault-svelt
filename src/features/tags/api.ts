import { api } from '$lib/api/client';
import type { ListParams } from '$lib/api/types';
import type { CreateTagInput, Tag, TagSort, UpdateTagInput } from './types';

export interface TagListParams extends ListParams {
  sort?: TagSort;
}

/**
 * Tags are attached through the owning record: send `tag_ids` when creating
 * or updating a project, commit, deployment, release or note (it replaces the
 * set), and filter those lists with `tag_id`.
 */
export const tagsApi = {
  list: (params: TagListParams = {}, signal?: AbortSignal) => api.list<Tag>('/tags', { query: params, signal }),
  get: (id: string, signal?: AbortSignal) => api.get<Tag>(`/tags/${id}`, { signal }),
  /** 409 with `details.name` when a tag with the same name exists. */
  create: (input: CreateTagInput) => api.post<Tag>('/tags', input),
  update: (id: string, input: UpdateTagInput) => api.patch<Tag>(`/tags/${id}`, input),
  /** Detaches the tag from every record. */
  remove: (id: string) => api.del(`/tags/${id}`),
};
