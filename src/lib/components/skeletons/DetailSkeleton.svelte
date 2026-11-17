<!-- Loading placeholder for a detail page: header + two-column body. -->
<script lang="ts">
  import { Skeleton } from '$lib/components/ui/skeleton';
  import { cn } from '$lib/utils/cn';

  interface Props {
    /** Hide the header block when the page already rendered its own PageHeader. */
    header?: boolean;
    class?: string;
  }

  let { header = true, class: className }: Props = $props();
</script>

<div class={cn('space-y-6', className)} role="status" aria-busy="true" aria-label="Loading">
  {#if header}
    <div class="space-y-3">
      <Skeleton class="h-3 w-40" />
      <Skeleton class="h-6 w-72" />
      <Skeleton class="h-3.5 w-96 max-w-full" />
    </div>
  {/if}
  <div class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
    <div class="bg-card space-y-3 rounded-lg border p-5">
      <Skeleton class="h-4 w-32" />
      <Skeleton class="h-3.5 w-full" />
      <Skeleton class="h-3.5 w-11/12" />
      <Skeleton class="h-3.5 w-4/5" />
      <Skeleton class="mt-6 h-4 w-28" />
      <Skeleton class="h-3.5 w-full" />
      <Skeleton class="h-3.5 w-3/4" />
    </div>
    <div class="bg-card space-y-4 rounded-lg border p-5">
      {#each { length: 5 } as _, index (index)}
        <div class="space-y-2">
          <Skeleton class="h-3 w-20" />
          <Skeleton class="h-3.5 w-36" />
        </div>
      {/each}
    </div>
  </div>
</div>
