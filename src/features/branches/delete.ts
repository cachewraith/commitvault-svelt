import { confirm } from '$lib/components';
import { pluralize } from '$lib/utils';
import type { Branch } from './types';

/**
 * Asks before deleting. A branch with commits can only go together with them
 * (and their deployment records), so the dialog says so and the answer means
 * `cascade`. Resolves to `null` when cancelled.
 */
export async function confirmBranchDeletion(
  branch: Pick<Branch, 'name' | 'commit_count'>,
): Promise<{ cascade: boolean } | null> {
  const hasCommits = branch.commit_count > 0;
  const ok = await confirm({
    title: `Delete branch “${branch.name}”?`,
    description: hasCommits
      ? `Its ${pluralize(branch.commit_count, 'commit')} and their deployment records are deleted too. This cannot be undone. To keep them, move the commits to another branch first.`
      : 'The branch has no commits. This cannot be undone.',
    confirmLabel: hasCommits ? 'Delete branch and commits' : 'Delete branch',
    destructive: true,
  });
  return ok ? { cascade: hasCommits } : null;
}
