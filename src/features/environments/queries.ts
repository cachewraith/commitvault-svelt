import type { QueryClient } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api';

/**
 * After creating, editing or reordering an environment. Deployment records,
 * commits and the dashboard embed environment names and colours.
 */
export function invalidateEnvironments(queryClient: QueryClient): void {
  for (const key of [
    queryKeys.environments.all,
    queryKeys.deployments.all,
    queryKeys.commits.all,
    queryKeys.projects.all,
    queryKeys.dashboard.all,
    queryKeys.search.all,
  ]) {
    void queryClient.invalidateQueries({ queryKey: key });
  }
}
