<!--
  Secondary filters behind one button, so a filter bar shows only the
  controls used most. The button counts how many of the hidden filters are
  set, so an active filter is never invisible.

    <FilterBar …>
      <SearchInput … />
      <MoreFilters activeCount={…}>
        <DateRangeFilter … />
        <TagSelect … />
      </MoreFilters>
    </FilterBar>
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import SlidersIcon from '@lucide/svelte/icons/sliders-horizontal';
  import { Button } from '$lib/components/ui/button';
  import * as Popover from '$lib/components/ui/popover';

  interface Props {
    children: Snippet;
    /** Number of filters inside that differ from their default. */
    activeCount?: number;
    label?: string;
  }

  let { children, activeCount = 0, label = 'More filters' }: Props = $props();
</script>

<Popover.Root>
  <Popover.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="outline" aria-label={activeCount > 0 ? `${label} (${activeCount} active)` : label}>
        <SlidersIcon aria-hidden="true" />
        {label}
        {#if activeCount > 0}
          <span class="bg-brand/15 text-brand tabular rounded-sm px-1 text-xs" aria-hidden="true">{activeCount}</span>
        {/if}
      </Button>
    {/snippet}
  </Popover.Trigger>
  <Popover.Content align="start" class="flex w-auto max-w-[calc(100vw-2rem)] min-w-80 flex-col gap-3 p-3">
    {@render children()}
  </Popover.Content>
</Popover.Root>
