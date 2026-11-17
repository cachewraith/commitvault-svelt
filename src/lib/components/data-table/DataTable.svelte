<!--
  Dense, bordered table shell. Compose with the parts exported from
  `$lib/components/data-table`:

    <DataTable label="Commits">
      <DataTableHeader>
        <DataTableRow>
          <DataTableHead sortKey="commit_date" {sort} {order} {onsort}>Date</DataTableHead>
          <DataTableHead>Message</DataTableHead>
        </DataTableRow>
      </DataTableHeader>
      <DataTableBody>
        {#each rows as row (row.id)}
          <DataTableRow href={paths.commit(row.id)}>
            <DataTableCell>…</DataTableCell>
          </DataTableRow>
        {/each}
      </DataTableBody>
    </DataTable>
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  interface Props {
    /** Accessible name of the table. */
    label: string;
    children: Snippet;
    /** Rendered under the table inside the same card (e.g. Pagination). */
    footer?: Snippet;
    class?: string;
  }

  let { label, children, footer, class: className }: Props = $props();
</script>

<div class={cn('bg-card overflow-hidden rounded-lg border', className)}>
  <!-- `relative`: keeps absolutely positioned descendants (e.g. `sr-only` labels in
       off-screen columns) inside the scroll area instead of widening the page. -->
  <div class="relative overflow-x-auto">
    <table class="w-full caption-bottom border-collapse text-sm" aria-label={label}>
      {@render children()}
    </table>
  </div>
  {#if footer}
    <div class="border-t px-3 py-2.5">
      {@render footer()}
    </div>
  {/if}
</div>
