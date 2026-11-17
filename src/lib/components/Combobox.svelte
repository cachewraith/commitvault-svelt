<!--
  Searchable single-select (project, environment, commit pickers).

    <Combobox options={projectOptions} bind:value={projectId} placeholder="All projects" clearable />

  Server-side search: pass `onsearch` (debounce it in the parent or use the
  built-in `searchDelay`) and feed the results back through `options`; client
  filtering is then disabled. `selectedLabel` keeps the trigger text correct
  when the selected option is not in the current result page.
-->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
  import XIcon from '@lucide/svelte/icons/x';
  import * as Command from '$lib/components/ui/command';
  import * as Popover from '$lib/components/ui/popover';
  import { cn } from '$lib/utils/cn';
  import { debounce } from '$lib/utils/debounce';
  import type { ComboboxOption } from './combobox';

  interface Props {
    options: ComboboxOption[];
    /** Selected option value, or `null`. */
    value?: string | null;
    onchange?: (value: string | null) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    /** Label for the selected value when it is not present in `options`. */
    selectedLabel?: string;
    /** Called (debounced) with the search text; enables server-side filtering. */
    onsearch?: (query: string) => void;
    searchDelay?: number;
    loading?: boolean;
    /** Show a button that resets the value to `null`. */
    clearable?: boolean;
    disabled?: boolean;
    /** Spread from `<FormField>`: id / aria-invalid / aria-describedby. */
    id?: string;
    'aria-invalid'?: 'true';
    'aria-describedby'?: string;
    'aria-label'?: string;
    class?: string;
  }

  let {
    options,
    value = $bindable(null),
    onchange,
    placeholder = 'Select…',
    searchPlaceholder = 'Search…',
    emptyText = 'No matches.',
    selectedLabel,
    onsearch,
    searchDelay = 250,
    loading = false,
    clearable = false,
    disabled = false,
    id,
    'aria-invalid': ariaInvalid,
    'aria-describedby': ariaDescribedBy,
    'aria-label': ariaLabel,
    class: className,
  }: Props = $props();

  let open = $state(false);
  let search = $state('');

  const selected = $derived(options.find((option) => option.value === value));
  const label = $derived(selected?.label ?? (value ? selectedLabel : undefined));

  // The delay is fixed for the lifetime of the component.
  // svelte-ignore state_referenced_locally
  const emitSearch = debounce((query: string) => onsearch?.(query), searchDelay);
  onDestroy(() => emitSearch.cancel());

  $effect(() => {
    if (onsearch) emitSearch(search.trim());
  });

  function select(next: string | null) {
    value = next;
    onchange?.(next);
    open = false;
    search = '';
  }
</script>

<Popover.Root bind:open>
  <div class={cn('relative w-full', className)}>
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
        clearable && value && 'pr-14',
      )}
    >
      <span class={cn('truncate', !label && 'text-muted-foreground')}>{label ?? placeholder}</span>
      <ChevronsUpDownIcon class="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
    </Popover.Trigger>
    {#if clearable && value && !disabled}
      <button
        type="button"
        class="text-muted-foreground hover:text-foreground absolute top-1/2 right-7 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm"
        aria-label="Clear selection"
        onclick={() => select(null)}
      >
        <XIcon class="size-3.5" aria-hidden="true" />
      </button>
    {/if}
  </div>

  <Popover.Content class="w-(--bits-popover-anchor-width) min-w-56 p-0" align="start">
    <Command.Root shouldFilter={!onsearch}>
      <Command.Input bind:value={search} placeholder={searchPlaceholder} />
      <Command.List class="max-h-64">
        {#if loading}
          <Command.Loading class="text-muted-foreground px-3 py-4 text-center text-sm">
            Loading…
          </Command.Loading>
        {:else}
          <Command.Empty class="text-muted-foreground px-3 py-4 text-center text-sm">
            {emptyText}
          </Command.Empty>
        {/if}
        <Command.Group>
          {#each options as option (option.value)}
            <Command.Item
              value={option.value}
              keywords={[option.label, ...(option.keywords ?? [])]}
              disabled={option.disabled}
              data-checked={option.value === value}
              onSelect={() => select(option.value)}
            >
              <span class="flex min-w-0 flex-col">
                <span class="truncate">{option.label}</span>
                {#if option.description}
                  <span class="text-muted-foreground truncate text-xs">{option.description}</span>
                {/if}
              </span>
            </Command.Item>
          {/each}
        </Command.Group>
      </Command.List>
    </Command.Root>
  </Popover.Content>
</Popover.Root>
