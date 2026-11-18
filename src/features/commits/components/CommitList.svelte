<!--
  Compact, read-only list of commits (hash chip, message, branch, date) for
  embedding in other screens: project overview, release detail, dashboard.
  Accepts full commits or briefs; project and recorded deployments appear only
  for full commits. Renders nothing for an empty array — the parent owns the
  empty state.
-->
<script lang="ts">
  import { BranchBadge, DateTime, HashChip } from '$lib/components';
  import { paths } from '$routes/paths';
  import { branchNameOf, commitSubject, isFullCommit } from '../format';
  import type { Commit, CommitBrief } from '../types';
  import CommitDeploymentBadges from './CommitDeploymentBadges.svelte';

  interface Props {
    commits: (Commit | CommitBrief)[];
    /** Show the project name (cross-project lists). */
    showProject?: boolean;
    /** Show where each commit has recorded deployments (full commits only). */
    showDeployments?: boolean;
    label?: string;
  }

  let { commits, showProject = false, showDeployments = false, label = 'Commits' }: Props = $props();
</script>

{#if commits.length > 0}
  <ul aria-label={label} class="bg-card divide-y rounded-lg border">
    {#each commits as commit (commit.id)}
      {@const full = isFullCommit(commit) ? commit : null}
      <li class="flex flex-col gap-1.5 px-3 py-2">
        <div class="flex min-w-0 items-center gap-3">
          <HashChip
            hash={commit.commit_hash}
            short={commit.short_hash}
            href={paths.commit(commit.id)}
          />
          <a
            href={paths.commit(commit.id)}
            class="text-foreground hover:text-brand min-w-0 flex-1 truncate text-sm"
            title={commitSubject(commit.commit_message)}
          >
            {commitSubject(commit.commit_message)}
          </a>
          <DateTime value={commit.commit_date} mode="relative" class="text-muted-foreground tabular shrink-0 text-xs" />
        </div>
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <BranchBadge name={branchNameOf(commit)} href={full ? paths.branch(full.branch_id) : undefined} />
          {#if showProject && full}
            <a href={paths.project(full.project.id)} class="text-muted-foreground hover:text-foreground text-xs">
              {full.project.name}
            </a>
          {/if}
          {#if showDeployments && full}
            <CommitDeploymentBadges environments={full.environments} />
          {/if}
        </div>
      </li>
    {/each}
  </ul>
{/if}
