<!--
  The sort menu shared by every list. Pair it with `sortState()`:

    const sorting = sortState(OPTIONS);
    <SortSelect options={OPTIONS} state={sorting} label="Sort commits" />

  Put it in the FilterBar's `actions` snippet so it sits in the same place on every list.
-->
<script lang="ts" generics="S extends string">
  import ArrowDownUpIcon from '@lucide/svelte/icons/arrow-down-up';
  import * as Select from '$lib/components/ui/select';
  import type { SortOption, SortState } from '$lib/router';
  import { cn } from '$lib/utils/cn';

  interface Props {
    options: readonly SortOption<S>[];
    state: SortState<S>;
    /** Accessible name, e.g. "Sort commits". */
    label?: string;
    class?: string;
  }

  let { options, state, label = 'Sort', class: className }: Props = $props();

  const key = (option: Pick<SortOption, 'sort' | 'order'>) => `${option.sort}:${option.order}`;
  const value = $derived(key({ sort: state.sort, order: state.order }));

  function choose(next: string) {
    const option = options.find((candidate) => key(candidate) === next);
    if (option) state.set(option.sort, option.order);
  }
</script>

<Select.Root type="single" {value} onValueChange={choose}>
  <Select.Trigger class={cn('w-full sm:w-52', className)} aria-label={label}>
    <span class="flex min-w-0 items-center gap-2">
      <ArrowDownUpIcon class="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
      <span class="truncate">{state.option?.label ?? 'Custom order'}</span>
    </span>
  </Select.Trigger>
  <Select.Content>
    {#each options as option (key(option))}
      <Select.Item value={key(option)} label={option.label} />
    {/each}
  </Select.Content>
</Select.Root>
