<!--
  Column header. Give it `sortKey` plus the current `sort`/`order` and an
  `onsort` handler to make it a sortable column (button + aria-sort).
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
  import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
  import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
  import type { SortOrder } from '$lib/api/types';
  import { cn } from '$lib/utils/cn';

  interface Props {
    children?: Snippet;
    /** Backend sort field for this column; enables sorting. */
    sortKey?: string;
    /** Currently active sort field. */
    sort?: string;
    order?: SortOrder;
    /** Called with the next sort state when the header is activated. */
    onsort?: (sort: string, order: SortOrder) => void;
    /** Order applied when the column is first selected. */
    defaultOrder?: SortOrder;
    align?: 'left' | 'right' | 'center';
    class?: string;
  }

  let {
    children,
    sortKey,
    sort,
    order = 'desc',
    onsort,
    defaultOrder = 'desc',
    align = 'left',
    class: className,
  }: Props = $props();

  const sortable = $derived(Boolean(sortKey && onsort));
  const active = $derived(sortable && sort === sortKey);
  const ariaSort = $derived(
    !sortable ? undefined : active ? (order === 'asc' ? 'ascending' : 'descending') : 'none',
  );

  function toggle() {
    if (!sortKey || !onsort) return;
    onsort(sortKey, active ? (order === 'asc' ? 'desc' : 'asc') : defaultOrder);
  }
</script>

<th
  scope="col"
  aria-sort={ariaSort}
  class={cn(
    'eyebrow h-9 px-3 align-middle whitespace-nowrap',
    align === 'right' && 'text-right',
    align === 'center' && 'text-center',
    align === 'left' && 'text-left',
    className,
  )}
>
  {#if sortable}
    <button
      type="button"
      class={cn(
        'hover:text-foreground -mx-1 inline-flex items-center gap-1 rounded-sm px-1 transition-colors',
        active && 'text-foreground',
      )}
      onclick={toggle}
    >
      {@render children?.()}
      {#if active && order === 'asc'}
        <ArrowUpIcon class="size-3" aria-hidden="true" />
      {:else if active}
        <ArrowDownIcon class="size-3" aria-hidden="true" />
      {:else}
        <ChevronsUpDownIcon class="size-3 opacity-50" aria-hidden="true" />
      {/if}
    </button>
  {:else}
    {@render children?.()}
  {/if}
</th>
