/** Minimal, valid API records for tests. Override what a test cares about. */
import type { Environment } from '$features/environments/types';
import type { Tag } from '$features/tags/types';
import type { Project } from '../../types';

const NOW = '2026-03-01T10:00:00Z';

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'Billing API',
    slug: 'billing-api',
    description: null,
    repository_url: null,
    default_branch: 'main',
    status: 'active',
    created_at: NOW,
    updated_at: NOW,
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
    ...overrides,
  };
}

export function makeEnvironment(overrides: Partial<Environment> = {}): Environment {
  return {
    id: 'e1',
    project_id: 'p1',
    project: { id: 'p1', name: 'Billing API', slug: 'billing-api' },
    name: 'Staging',
    slug: 'staging',
    description: null,
    color: '#eab308',
    server_label: null,
    position: 0,
    created_at: NOW,
    updated_at: NOW,
    deployment_count: 0,
    latest_deployment: null,
    latest_successful_deployment: null,
    ...overrides,
  };
}

export function makeTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: 't1',
    name: 'urgent',
    slug: 'urgent',
    color: '#ef4444',
    created_at: NOW,
    updated_at: NOW,
    usage: {
      project_count: 0,
      commit_count: 0,
      deployment_count: 0,
      release_count: 0,
      note_count: 0,
      total: 0,
    },
    ...overrides,
  };
}
