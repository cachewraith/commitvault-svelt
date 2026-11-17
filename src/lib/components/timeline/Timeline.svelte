<!--
  Vertical timeline (deployment history, activity feeds).

    <Timeline label="Deployment history">
      {#each deployments as d (d.id)}
        <TimelineItem tone="success" icon={RocketIcon}>
          {#snippet title()}…{/snippet}
          {#snippet meta()}<DateTime value={d.deployed_at} />{/snippet}
          …body…
        </TimelineItem>
      {/each}
    </Timeline>
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  interface Props {
    /** Accessible name of the list. */
    label: string;
    children: Snippet;
    class?: string;
  }

  let { label, children, class: className }: Props = $props();
</script>

<ol aria-label={label} class={cn('relative flex flex-col', className)}>
  {@render children()}
</ol>
