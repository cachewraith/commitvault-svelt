<!--
  Searchable multi-select (tags, release commits). Same option/search contract
  as `Combobox`; `values` is the list of selected option values.

    <MultiCombobox options={tagOptions} bind:values={tagIds} placeholder="Add tags" />

  `selectedOptions` supplies labels for selected values that are missing from
  the current `options` page (server-side search).
-->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import * as Command from '$lib/components/ui/command';
  import * as Popover from '$lib/components/ui/popover';
  import { cn } from '$lib/utils/cn';
  import { debounce } from '$lib/utils/debounce';
  import type { ComboboxOption } from './combobox';

  interface Props {
    options: ComboboxOption[];
    values?: string[];
    onchange?: (values: string[]) => void;
    /** Known options for already-selected values (labels for the trigger summary). */
    selectedOptions?: ComboboxOption[];
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    onsearch?: (query: string) => void;
    searchDelay?: number;
    loading?: boolean;
    /** Offer "Create «text»" when the search text matches no option. */
    oncreate?: (label: string) => void;
    /** Maximum number of selections. */
    max?: number;
    disabled?: boolean;
    id?: string;
    'aria-invalid'?: 'true';
    'aria-describedby'?: string;
    'aria-label'?: string;
    class?: string;
  }

  let {
    options,
    values = $bindable([]),
    onchange,
    selectedOptions = [],
    placeholder = 'Select…',
    searchPlaceholder = 'Search…',
    emptyText = 'No matches.',
    onsearch,
    searchDelay = 250,
    loading = false,
    oncreate,
    max,
    disabled = false,
    id,
    'aria-invalid': ariaInvalid,
    'aria-describedby': ariaDescribedBy,
    'aria-label': ariaLabel,
    class: className,
  }: Props = $props();

  let open = $state(false);
  let search = $state('');

  const labels = $derived.by(() => {
    const map = new Map<string, string>();
    for (const option of selectedOptions) map.set(option.value, option.label);
    for (const option of options) map.set(option.value, option.label);
    return map;
  });

  const summary = $derived.by(() => {
    if (values.length === 0) return null;
    const names = values.map((value) => labels.get(value) ?? value);
    return names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
  });

  const atLimit = $derived(max !== undefined && values.length >= max);
  const trimmedSearch = $derived(search.trim());
  const canCreate = $derived(
    Boolean(oncreate) &&
      trimmedSearch !== '' &&
      !options.some((option) => option.label.toLowerCase() === trimmedSearch.toLowerCase()),
  );

  // The delay is fixed for the lifetime of the component.
  // svelte-ignore state_referenced_locally
  const emitSearch = debounce((query: string) => onsearch?.(query), searchDelay);
  onDestroy(() => emitSearch.cancel());

  $effect(() => {
    if (onsearch) emitSearch(search.trim());
  });

  function toggle(value: string) {
    const next = values.includes(value)
      ? values.filter((item) => item !== value)
      : atLimit
        ? values
        : [...values, value];
    values = next;
    onchange?.(next);
  }

  function create() {
    oncreate?.(trimmedSearch);
    search = '';
  }
</script>

<Popover.Root bind:open>
  <Popover.Trigger
    {id}
    {disabled}
    role="combobox"
    aria-expanded={open}
    aria-invalid={ariaInvalid}
    aria-describedby={ariaDescribedBy}
    aria-label={ariaLabel}
    class={cn(
      'border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive flex h-8 w-full items-center justify-between gap-2 rounded-lg border bg-transparent px-2.5 text-left text-sm outline-none transition-colors focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
  >
    <span class={cn('truncate', !summary && 'text-muted-foreground')}>{summary ?? placeholder}</span>
    <ChevronsUpDownIcon class="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
  </Popover.Trigger>

  <Popover.Content class="w-(--bits-popover-anchor-width) min-w-56 p-0" align="start">
    <Command.Root shouldFilter={!onsearch}>
      <Command.Input bind:value={search} placeholder={searchPlaceholder} />
      <Command.List class="max-h-64">
        {#if loading}
          <Command.Loading class="text-muted-foreground px-3 py-4 text-center text-sm">
            Loading…
          </Command.Loading>
        {:else if !canCreate}
          <Command.Empty class="text-muted-foreground px-3 py-4 text-center text-sm">
            {emptyText}
          </Command.Empty>
        {/if}
        <Command.Group>
          {#each options as option (option.value)}
            {@const checked = values.includes(option.value)}
            <Command.Item
              value={option.value}
              keywords={[option.label, ...(option.keywords ?? [])]}
              disabled={option.disabled || (atLimit && !checked)}
              data-checked={checked}
              onSelect={() => toggle(option.value)}
            >
              <span class="flex min-w-0 flex-col">
                <span class="truncate">{option.label}</span>
                {#if option.description}
                  <span class="text-muted-foreground truncate text-xs">{option.description}</span>
                {/if}
              </span>
            </Command.Item>
          {/each}
          {#if canCreate}
            <Command.Item value={`__create__${trimmedSearch}`} forceMount onSelect={create}>
              <PlusIcon aria-hidden="true" />
              <span class="truncate">Create “{trimmedSearch}”</span>
            </Command.Item>
          {/if}
        </Command.Group>
      </Command.List>
    </Command.Root>
  </Popover.Content>
</Popover.Root>
