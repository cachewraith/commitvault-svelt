import type { QueryClient } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api';

/**
 * After creating, renaming or deleting a branch. Commits, deployment records,
 * releases and search results embed branch names; a renamed default branch
 * changes the project; a cascading delete removes commits and records.
 */
export function invalidateBranches(queryClient: QueryClient): void {
  for (const key of [
    queryKeys.branches.all,
    queryKeys.commits.all,
    queryKeys.deployments.all,
    queryKeys.environments.all,
    queryKeys.releases.all,
    queryKeys.projects.all,
    queryKeys.dashboard.all,
    queryKeys.search.all,
  ]) {
    void queryClient.invalidateQueries({ queryKey: key });
  }
}
