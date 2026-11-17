<!--
  Layout for a row of filters above a list. Put the SearchInput first, then
  selects/date ranges; `actions` is right-aligned (e.g. a "New" button).
  When `active` is true a "Clear filters" button calls `onreset`.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import FilterXIcon from '@lucide/svelte/icons/funnel-x';
  import { Button } from '$lib/components/ui/button';
  import { cn } from '$lib/utils/cn';

  interface Props {
    children: Snippet;
    actions?: Snippet;
    /** Whether any filter differs from its default. */
    active?: boolean;
    onreset?: () => void;
    /** Accessible name of the filter group. */
    label?: string;
    class?: string;
  }

  let {
    children,
    actions,
    active = false,
    onreset,
    label = 'Filters',
    class: className,
  }: Props = $props();
</script>

<div
  class={cn('mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between', className)}
>
  <div role="group" aria-label={label} class="flex min-w-0 flex-1 flex-wrap items-end gap-2">
    {@render children()}
    {#if active && onreset}
      <Button variant="ghost" size="sm" class="text-muted-foreground" onclick={onreset}>
        <FilterXIcon aria-hidden="true" />
        Clear filters
      </Button>
    {/if}
  </div>
  {#if actions}
    <div class="flex shrink-0 flex-wrap items-center gap-2">
      {@render actions()}
    </div>
  {/if}
</div>
