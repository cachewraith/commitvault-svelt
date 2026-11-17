<!--
  Where a commit has recorded deployments: one environment badge per
  environment with the status of its latest record. An empty list is shown as
  "No deployment recorded" — a statement about records, not about servers.
-->
<script lang="ts">
  import { EnvironmentBadge, StatusBadge } from '$lib/components';
  import { cn } from '$lib/utils/cn';
  import { formatDateTime, pluralize } from '$lib/utils/format';
  import type { CommitEnvironment } from '../types';

  interface Props {
    environments: CommitEnvironment[];
    /** Text shown when there is no record. */
    emptyText?: string;
    class?: string;
  }

  let { environments, emptyText = 'No deployment recorded', class: className }: Props = $props();
</script>

{#if environments.length === 0}
  <span class={cn('text-muted-foreground text-xs', className)}>{emptyText}</span>
{:else}
  <ul class={cn('flex flex-wrap items-center gap-x-3 gap-y-1', className)} aria-label="Recorded deployments">
    {#each environments as environment (environment.id)}
      <li
        class="inline-flex items-center gap-1.5"
        title="{pluralize(environment.deployment_count, 'record')} · latest {formatDateTime(
          environment.latest_deployed_at,
        )}"
      >
        <EnvironmentBadge name={environment.name} color={environment.color} size="sm" />
        <StatusBadge status={environment.latest_status} variant="dot" class="text-xs" />
      </li>
    {/each}
  </ul>
{/if}
