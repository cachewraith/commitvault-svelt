import type { QueryClient } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api';
import { pluralize } from '$lib/utils';
import type { Project } from './types';

/** After creating or editing a project (its tags feed the tag usage counts). */
export function invalidateProjects(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.search.all });
}

/**
 * After archiving, restoring or deleting a project. Every other resource
 * embeds its project (or disappears with it), so nothing cached stays valid.
 */
export function invalidateAllProjectData(queryClient: QueryClient): void {
  void queryClient.invalidateQueries();
}

/** "3 environments, 12 commits, 5 deployment records, 1 release and 2 notes" — or `null` when the project is empty. */
export function describeProjectContents(project: Pick<Project, 'stats'>): string | null {
  const { stats } = project;
  const parts = [
    stats.environment_count > 0 ? pluralize(stats.environment_count, 'environment') : null,
    stats.commit_count > 0 ? pluralize(stats.commit_count, 'commit') : null,
    stats.deployment_count > 0 ? pluralize(stats.deployment_count, 'deployment record') : null,
    stats.release_count > 0 ? pluralize(stats.release_count, 'release') : null,
    stats.note_count > 0 ? pluralize(stats.note_count, 'note') : null,
  ].filter((part): part is string => part !== null);

  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0] ?? null;
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** Consequence text for the delete confirmation. */
export function deleteProjectDescription(project: Pick<Project, 'name' | 'stats'>): string {
  const contents = describeProjectContents(project);
  return contents
    ? `This permanently deletes “${project.name}” together with its ${contents}. This cannot be undone.`
    : `This permanently deletes “${project.name}”. It has no recorded data yet. This cannot be undone.`;
}
