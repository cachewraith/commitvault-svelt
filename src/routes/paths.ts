/**
 * Path builders — the only place URLs are spelled out. Use these instead of
 * string concatenation: `href={paths.commit(commit.id)}`.
 */
import { buildPath, withQuery, type QueryInput } from '$lib/router/match';

export const paths = {
  dashboard: () => '/',
  login: (next?: string) => withQuery('/login', { next }),
  forgotPassword: (query?: QueryInput) => withQuery('/forgot-password', query),

  projects: (query?: QueryInput) => withQuery('/projects', query),
  project: (projectId: string) => buildPath('/projects/:projectId', { projectId }),
  projectSettings: (projectId: string) => buildPath('/projects/:projectId/settings', { projectId }),
  projectEnvironments: (projectId: string) =>
    buildPath('/projects/:projectId/environments', { projectId }),
  projectBranches: (projectId: string, query?: QueryInput) =>
    withQuery(buildPath('/projects/:projectId/branches', { projectId }), query),
  branch: (branchId: string) => buildPath('/branches/:branchId', { branchId }),
  projectCompare: (projectId: string, query?: QueryInput) =>
    withQuery(buildPath('/projects/:projectId/compare', { projectId }), query),

  environments: (query?: QueryInput) => withQuery('/environments', query),

  commits: (query?: QueryInput) => withQuery('/commits', query),
  commit: (commitId: string) => buildPath('/commits/:commitId', { commitId }),

  deployments: (query?: QueryInput) => withQuery('/deployments', query),
  deployment: (deploymentId: string) => buildPath('/deployments/:deploymentId', { deploymentId }),

  releases: (query?: QueryInput) => withQuery('/releases', query),
  release: (releaseId: string) => buildPath('/releases/:releaseId', { releaseId }),

  notes: (query?: QueryInput) => withQuery('/notes', query),
  noteNew: (query?: QueryInput) => withQuery('/notes/new', query),
  note: (noteId: string) => buildPath('/notes/:noteId', { noteId }),
  noteEdit: (noteId: string) => buildPath('/notes/:noteId/edit', { noteId }),

  tags: (query?: QueryInput) => withQuery('/tags', query),
  search: (q?: string) => withQuery('/search', { q }),
  settings: () => '/settings',
} as const;
