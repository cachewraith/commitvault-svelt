<!-- Titled block on the project overview: heading, optional count, "View all" link and actions. -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import { cn, formatNumber } from '$lib/utils';

  interface Props {
    title: string;
    /** Total number of records (shown next to the title). */
    count?: number;
    /** Link to the full, filtered list. */
    href?: string;
    viewAllLabel?: string;
    actions?: Snippet;
    children: Snippet;
    class?: string;
  }

  let { title, count, href, viewAllLabel = 'View all', actions, children, class: className }: Props = $props();

  const headingId = $props.id();
</script>

<section aria-labelledby={headingId} class={cn('flex flex-col gap-3', className)}>
  <div class="flex min-h-7 flex-wrap items-center justify-between gap-2">
    <h2 id={headingId} class="text-sm font-semibold">
      {title}
      {#if count !== undefined}
        <span class="text-muted-foreground tabular ml-1 font-normal">{formatNumber(count)}</span>
      {/if}
    </h2>
    <div class="flex items-center gap-1">
      {#if actions}
        {@render actions()}
      {/if}
      {#if href}
        <a
          {href}
          class="text-muted-foreground hover:text-foreground inline-flex h-7 items-center gap-0.5 rounded-md px-2 text-xs"
        >
          {viewAllLabel}<span class="sr-only">: {title}</span>
          <ChevronRightIcon class="size-3.5" aria-hidden="true" />
        </a>
      {/if}
    </div>
  </div>
  {@render children()}
</section>
