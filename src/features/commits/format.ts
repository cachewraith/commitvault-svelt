import type { ComboboxOption } from '$lib/components';
import { formatDate } from '$lib/utils/format';
import type { Commit, CommitBrief, CommitDeploymentFilter } from './types';

/** First line of a commit message (the subject). */
export function commitSubject(message: string): string {
  const newline = message.indexOf('\n');
  return (newline === -1 ? message : message.slice(0, newline)).trim();
}

/** Lines after the subject, or `''`. */
export function commitBody(message: string): string {
  const newline = message.indexOf('\n');
  return newline === -1 ? '' : message.slice(newline + 1).trim();
}

/** Picker option for a commit: "a1b2c3d  subject" with branch and date underneath. */
export function commitOption(commit: CommitBrief): ComboboxOption {
  return {
    value: commit.id,
    label: `${commit.short_hash}  ${commitSubject(commit.commit_message)}`,
    description: `${commit.branch_name} · ${formatDate(commit.commit_date)}`,
    keywords: [commit.commit_hash, commit.branch_name],
  };
}

/** Full commits carry their project; briefs (embedded references) do not. */
export function isFullCommit(commit: Commit | CommitBrief): commit is Commit {
  return 'project' in commit;
}

/**
 * Wording for the recorded-deployment filter. Every label talks about
 * *records*: "No deployment record" is not "never deployed".
 */
export const DEPLOYMENT_FILTER_LABELS: Record<CommitDeploymentFilter, string> = {
  any: 'Has deployment record',
  none: 'No deployment record',
  successful: 'Has successful record',
  failed: 'Has failed record',
  rolled_back: 'Has rolled-back record',
  pending: 'Has pending record',
};
