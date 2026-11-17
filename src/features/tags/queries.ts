import type { QueryClient } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api';

/** After creating a tag: only tag lists change. */
export function invalidateTagLists(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.search.all });
}

/**
 * After renaming, recolouring or deleting a tag: every tagged record embeds
 * its tags, so every tagged resource is stale.
 */
export function invalidateTaggedResources(queryClient: QueryClient): void {
  for (const key of [
    queryKeys.tags.all,
    queryKeys.projects.all,
    queryKeys.commits.all,
    queryKeys.deployments.all,
    queryKeys.releases.all,
    queryKeys.notes.all,
    queryKeys.dashboard.all,
    queryKeys.search.all,
  ]) {
    void queryClient.invalidateQueries({ queryKey: key });
  }
}
