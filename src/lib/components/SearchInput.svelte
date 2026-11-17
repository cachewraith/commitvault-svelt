<!--
  Debounced, clearable search box.

    <SearchInput value={search.value} onsearch={(q) => (search.value = q)} label="Search commits" />

  `value` is the committed (debounced) term owned by the parent — usually a URL
  query param. Typing updates the visible text immediately and calls `onsearch`
  after `delay` ms; Enter commits immediately; Escape or the × button clears.
-->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import SearchIcon from '@lucide/svelte/icons/search';
  import XIcon from '@lucide/svelte/icons/x';
  import { cn } from '$lib/utils/cn';
  import { debounce } from '$lib/utils/debounce';

  interface Props {
    /** Committed search term. */
    value?: string;
    onsearch: (value: string) => void;
    /** Accessible name (visually hidden). */
    label?: string;
    placeholder?: string;
    /** Debounce in ms. */
    delay?: number;
    disabled?: boolean;
    class?: string;
    /** Bind to focus the input programmatically. */
    ref?: HTMLInputElement | null;
  }

  let {
    value = '',
    onsearch,
    label = 'Search',
    placeholder = 'Search…',
    delay = 300,
    disabled = false,
    class: className,
    ref = $bindable(null),
  }: Props = $props();

  const id = $props.id();
  // svelte-ignore state_referenced_locally
  let text = $state(value);
  // svelte-ignore state_referenced_locally
  let committed = value;

  // The delay is fixed for the lifetime of the component.
  // svelte-ignore state_referenced_locally
  const emit = debounce((next: string) => commit(next), delay);

  function commit(next: string) {
    const trimmed = next.trim();
    if (trimmed === committed) return;
    committed = trimmed;
    onsearch(trimmed);
  }

  // Follow external changes (back/forward navigation, "clear filters").
  $effect(() => {
    if (value !== committed) {
      committed = value;
      text = value;
      emit.cancel();
    }
  });

  onDestroy(() => emit.cancel());

  function oninput(event: Event) {
    text = (event.currentTarget as HTMLInputElement).value;
    emit(text);
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      emit.cancel();
      commit(text);
    } else if (event.key === 'Escape' && text !== '') {
      event.preventDefault();
      clear();
    }
  }

  function clear() {
    text = '';
    emit.cancel();
    commit('');
    ref?.focus();
  }
</script>

<div class={cn('relative w-full sm:max-w-xs', className)} role="search">
  <label for={id} class="sr-only">{label}</label>
  <SearchIcon
    class="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
    aria-hidden="true"
  />
  <input
    bind:this={ref}
    {id}
    type="text"
    inputmode="search"
    enterkeyhint="search"
    autocomplete="off"
    spellcheck="false"
    {placeholder}
    {disabled}
    value={text}
    {oninput}
    {onkeydown}
    class="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-8 w-full rounded-lg border bg-transparent pr-8 pl-8 text-sm outline-none transition-colors focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50"
  />
  {#if text !== ''}
    <button
      type="button"
      class="text-muted-foreground hover:text-foreground absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm"
      aria-label="Clear search"
      onclick={clear}
    >
      <XIcon class="size-3.5" aria-hidden="true" />
    </button>
  {/if}
</div>
