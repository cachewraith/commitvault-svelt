<!-- Loading placeholder shaped like a dense table. -->
<script lang="ts">
  import { Skeleton } from '$lib/components/ui/skeleton';
  import { cn } from '$lib/utils/cn';

  interface Props {
    rows?: number;
    columns?: number;
    class?: string;
  }

  let { rows = 8, columns = 5, class: className }: Props = $props();

  const widths = ['w-24', 'w-40', 'w-56', 'w-20', 'w-28', 'w-16'];
</script>

<div
  class={cn('bg-card overflow-hidden rounded-lg border', className)}
  role="status"
  aria-busy="true"
  aria-label="Loading"
>
  <div class="bg-muted/40 flex items-center gap-6 border-b px-3 py-2.5">
    {#each { length: columns } as _, column (column)}
      <Skeleton class="h-3 w-16" />
    {/each}
  </div>
  {#each { length: rows } as _, row (row)}
    <div class="flex items-center gap-6 border-b px-3 py-3 last:border-b-0">
      {#each { length: columns } as _, column (column)}
        <Skeleton class={cn('h-3.5', widths[(row + column) % widths.length])} />
      {/each}
    </div>
  {/each}
</div>
