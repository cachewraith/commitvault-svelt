<!--
  Compact, read-only list of releases for embedding (project overview).
  Renders nothing when empty — the parent owns the empty state.
-->
<script lang="ts">
  import { DateTime, StatusBadge } from '$lib/components';
  import { pluralize } from '$lib/utils';
  import { paths } from '$routes/paths';
  import type { Release } from '../types';

  interface Props {
    releases: Release[];
    /** Show the project name (cross-project lists). */
    showProject?: boolean;
    label?: string;
  }

  let { releases, showProject = false, label = 'Releases' }: Props = $props();
</script>

{#if releases.length > 0}
  <ul aria-label={label} class="divide-y">
    {#each releases as release (release.id)}
      <li class="animate-enter flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
        <a
          href={paths.release(release.id)}
          class="text-brand shrink-0 font-mono text-[0.8125rem] font-medium hover:underline"
        >
          {release.version}
        </a>
        <span class="min-w-0 flex-1 basis-40 truncate" title={release.title}>{release.title}</span>
        {#if showProject}
          <a
            href={paths.project(release.project.id)}
            class="text-muted-foreground hover:text-foreground max-w-[20ch] truncate text-xs"
          >
            {release.project.name}
          </a>
        {/if}
        <StatusBadge status={release.status} />
        <span class="text-muted-foreground tabular shrink-0 text-xs">
          {pluralize(release.commit_count, 'commit')}
        </span>
        <span class="text-muted-foreground tabular w-24 shrink-0 text-right text-xs">
          {#if release.released_at}
            <DateTime value={release.released_at} mode="date" />
          {:else}
            Not released
          {/if}
        </span>
      </li>
    {/each}
  </ul>
{/if}
