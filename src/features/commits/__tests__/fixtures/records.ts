import type { Branch } from '$features/branches/types';
import type { Deployment } from '$features/deployments/types';
import type { Commit } from '../../types';

export const HASH = '9fceb02d0ae598e95dc970b74767f19372d61af8';

export const project = {
  id: 'p1',
  name: 'Shop',
  slug: 'shop',
  description: null,
  repository_url: null,
  default_branch: 'develop',
  status: 'active',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  archived_at: null,
  tags: [],
  stats: {
    commit_count: 0,
    environment_count: 0,
    deployment_count: 0,
    release_count: 0,
    note_count: 0,
    last_deployed_at: null,
  },
};

export function commit(overrides: Partial<Commit> = {}): Commit {
  return {
    id: 'c1',
    project_id: 'p1',
    project: { id: 'p1', name: 'Shop', slug: 'shop' },
    branch_id: 'b1',
    branch: { id: 'b1', name: 'main' },
    commit_hash: HASH,
    short_hash: '9fceb02',
    commit_message: 'feat: add checkout flow',
    description: null,
    commit_date: '2026-03-01T10:00:00Z',
    author_name: null,
    external_url: null,
    created_at: '2026-03-01T11:00:00Z',
    updated_at: '2026-03-01T11:00:00Z',
    tags: [],
    deployment_count: 0,
    environments: [],
    releases: [],
    ...overrides,
  };
}

export function environment(id: string, name: string) {
  return {
    id,
    project_id: 'p1',
    project: { id: 'p1', name: 'Shop', slug: 'shop' },
    name,
    slug: name.toLowerCase(),
    description: null,
    color: '#22c55e',
    server_label: null,
    position: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deployment_count: 0,
    latest_deployment: null,
    latest_successful_deployment: null,
  };
}

export function deployment(overrides: Partial<Deployment> = {}): Deployment {
  return {
    id: 'd1',
    project_id: 'p1',
    project: { id: 'p1', name: 'Shop', slug: 'shop' },
    environment: { id: 'e1', name: 'Production', slug: 'production', color: '#22c55e' },
    commit: {
      id: 'c1',
      short_hash: '9fceb02',
      commit_hash: HASH,
      commit_message: 'feat: add checkout flow',
      branch_name: 'main',
      commit_date: '2026-03-01T10:00:00Z',
    },
    deployment_title: 'Deploy 9fceb02 to Production',
    deployment_notes: null,
    deployed_at: '2026-03-02T09:00:00Z',
    status: 'successful',
    created_at: '2026-03-02T09:05:00Z',
    updated_at: '2026-03-02T09:05:00Z',
    tags: [],
    ...overrides,
  };
}

export function branch(overrides: Partial<Branch> = {}): Branch {
  return {
    id: 'b-develop',
    project_id: 'p1',
    project: { id: 'p1', name: 'Shop', slug: 'shop' },
    name: 'develop',
    description: null,
    is_default: true,
    commit_count: 3,
    last_commit_at: '2026-03-01T10:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}
