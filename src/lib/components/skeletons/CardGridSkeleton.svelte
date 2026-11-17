<!-- Loading placeholder shaped like a grid of cards (project list, stat tiles). -->
<script lang="ts">
  import { Skeleton } from '$lib/components/ui/skeleton';
  import { cn } from '$lib/utils/cn';

  interface Props {
    count?: number;
    /** Grid classes; override to match the real layout. */
    class?: string;
    /** Card height preset. */
    variant?: 'card' | 'stat';
  }

  let {
    count = 6,
    class: className = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3',
    variant = 'card',
  }: Props = $props();
</script>

<div class={cn(className)} role="status" aria-busy="true" aria-label="Loading">
  {#each { length: count } as _, index (index)}
    <div class="bg-card rounded-lg border p-4">
      {#if variant === 'stat'}
        <Skeleton class="h-3 w-20" />
        <Skeleton class="mt-3 h-7 w-16" />
      {:else}
        <div class="flex items-center justify-between gap-4">
          <Skeleton class="h-4 w-36" />
          <Skeleton class="h-5 w-14 rounded-full" />
        </div>
        <Skeleton class="mt-3 h-3 w-full" />
        <Skeleton class="mt-2 h-3 w-2/3" />
        <div class="mt-5 flex gap-3">
          <Skeleton class="h-3 w-16" />
          <Skeleton class="h-3 w-16" />
          <Skeleton class="h-3 w-16" />
        </div>
      {/if}
    </div>
  {/each}
</div>
