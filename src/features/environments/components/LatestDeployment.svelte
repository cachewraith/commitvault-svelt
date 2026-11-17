<!--
  One recorded deployment in a single line: status, commit, time. Without a
  record it says exactly that — a missing record is not evidence that nothing
  is deployed.
-->
<script lang="ts">
  import { DateTime, HashChip, StatusBadge } from '$lib/components';
  import { cn } from '$lib/utils';
  import { paths } from '$routes/paths';
  import type { DeploymentBrief } from '../types';

  interface Props {
    deployment: DeploymentBrief | null | undefined;
    /** Text shown when there is no record. */
    emptyText?: string;
    /** Show the commit message next to the hash. */
    showMessage?: boolean;
    /** Hide the status badge (e.g. in a "latest successful" column). */
    hideStatus?: boolean;
    class?: string;
  }

  let {
    deployment,
    emptyText = 'No deployment recorded',
    showMessage = false,
    hideStatus = false,
    class: className,
  }: Props = $props();
</script>

{#if deployment}
  <div class={cn('flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1', className)}>
    {#if !hideStatus}
      <StatusBadge status={deployment.status} />
    {/if}
    <HashChip
      hash={deployment.commit.commit_hash}
      short={deployment.commit.short_hash}
      href={paths.commit(deployment.commit.id)}
    />
    {#if showMessage}
      <span class="text-muted-foreground min-w-0 truncate" title={deployment.commit.commit_message}>
        {deployment.commit.commit_message}
      </span>
    {/if}
    <a
      href={paths.deployment(deployment.id)}
      class="text-muted-foreground hover:text-foreground tabular shrink-0 text-xs"
      aria-label={`Deployment record: ${deployment.deployment_title}`}
    >
      <DateTime value={deployment.deployed_at} />
    </a>
  </div>
{:else}
  <span class={cn('text-muted-foreground text-sm', className)}>{emptyText}</span>
{/if}
