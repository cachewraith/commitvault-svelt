<!-- Loading placeholder for stacked list rows (notes list, timeline, search results). -->
<script lang="ts">
  import { Skeleton } from '$lib/components/ui/skeleton';
  import { cn } from '$lib/utils/cn';

  interface Props {
    rows?: number;
    class?: string;
  }

  let { rows = 5, class: className }: Props = $props();
</script>

<div class={cn('space-y-3', className)} role="status" aria-busy="true" aria-label="Loading">
  {#each { length: rows } as _, index (index)}
    <div class="bg-card flex items-start gap-3 rounded-lg border p-4">
      <Skeleton class="mt-0.5 size-4 rounded-full" />
      <div class="flex-1 space-y-2">
        <Skeleton class="h-4 w-1/3" />
        <Skeleton class="h-3 w-4/5" />
      </div>
      <Skeleton class="h-3 w-16" />
    </div>
  {/each}
</div>
