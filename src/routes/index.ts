/**
 * Route table. Every page is loaded lazily (one chunk per route).
 *
 * To change what a URL renders, edit the page component file — the table
 * itself rarely needs to change. Route `:params` arrive as page props.
 */
import type { RouteDefinition } from '$lib/router';

export const routes: RouteDefinition[] = [
  {
    path: '/login',
    title: 'Sign in',
    access: 'guest',
    layout: 'auth',
    load: () => import('$features/auth/pages/LoginPage.svelte'),
  },

  { path: '/', title: 'Dashboard', load: () => import('$features/dashboard/pages/DashboardPage.svelte') },

  { path: '/projects', title: 'Projects', load: () => import('$features/projects/pages/ProjectListPage.svelte') },
  { path: '/projects/:projectId', title: 'Project', load: () => import('$features/projects/pages/ProjectDetailPage.svelte') },
  { path: '/projects/:projectId/settings', title: 'Project settings', load: () => import('$features/projects/pages/ProjectSettingsPage.svelte') },
  { path: '/projects/:projectId/environments', title: 'Environments', load: () => import('$features/environments/pages/EnvironmentManagePage.svelte') },
  { path: '/projects/:projectId/compare', title: 'Compare environments', load: () => import('$features/deployments/pages/EnvironmentComparePage.svelte') },

  { path: '/environments', title: 'Environments', load: () => import('$features/environments/pages/EnvironmentOverviewPage.svelte') },

  { path: '/commits', title: 'Commits', load: () => import('$features/commits/pages/CommitListPage.svelte') },
  { path: '/commits/:commitId', title: 'Commit', load: () => import('$features/commits/pages/CommitDetailPage.svelte') },

  { path: '/deployments', title: 'Deployments', load: () => import('$features/deployments/pages/DeploymentHistoryPage.svelte') },
  { path: '/deployments/:deploymentId', title: 'Deployment', load: () => import('$features/deployments/pages/DeploymentDetailPage.svelte') },

  { path: '/releases', title: 'Releases', load: () => import('$features/releases/pages/ReleaseListPage.svelte') },
  { path: '/releases/:releaseId', title: 'Release', load: () => import('$features/releases/pages/ReleaseDetailPage.svelte') },

  { path: '/notes', title: 'Notes', load: () => import('$features/notes/pages/NoteListPage.svelte') },
  { path: '/notes/new', title: 'New note', load: () => import('$features/notes/pages/NoteEditorPage.svelte') },
  { path: '/notes/:noteId', title: 'Note', load: () => import('$features/notes/pages/NoteReadPage.svelte') },
  { path: '/notes/:noteId/edit', title: 'Edit note', load: () => import('$features/notes/pages/NoteEditorPage.svelte') },

  { path: '/tags', title: 'Tags', load: () => import('$features/tags/pages/TagListPage.svelte') },
  { path: '/search', title: 'Search', load: () => import('$features/search/pages/SearchPage.svelte') },
  { path: '/settings', title: 'Settings', load: () => import('$features/settings/pages/SettingsPage.svelte') },
];

/** Rendered when no pattern matches. Reachable signed in or out. */
export const notFoundRoute: RouteDefinition = {
  path: '/404',
  title: 'Page not found',
  access: 'public',
  load: () => import('$features/errors/pages/NotFoundPage.svelte'),
};
