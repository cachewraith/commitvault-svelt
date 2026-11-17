<!--
  Searchable single select of a project's commits (hash, message, branch;
  server-side search). `selected` supplies the label of the current value; when
  it is missing the commit is fetched once so the trigger never shows a bare id.
-->
<script lang="ts">
  import { createQuery, keepPreviousData } from '@tanstack/svelte-query';
  import { queryKeys } from '$lib/api';
  import { Combobox } from '$lib/components';
  import { commitsApi } from '../api';
  import { commitOption } from '../format';
  import type { CommitBrief } from '../types';

  interface Props {
    projectId: string | null;
    /** Selected commit id. */
    value?: string | null;
    selected?: CommitBrief | null;
    onchange?: (commitId: string | null) => void;
    placeholder?: string;
    disabled?: boolean;
    id?: string;
    'aria-invalid'?: boolean | 'true' | 'false';
    'aria-describedby'?: string;
    'aria-required'?: boolean | 'true' | 'false';
    class?: string;
  }

  let {
    projectId,
    value = $bindable(null),
    selected = null,
    onchange,
    placeholder = 'Select a commit…',
    disabled = false,
    id,
    'aria-invalid': ariaInvalid,
    'aria-describedby': ariaDescribedBy,
    class: className,
  }: Props = $props();

  const PAGE_SIZE = 20;
  let search = $state('');

  const params = $derived({ project_id: projectId ?? undefined, search: search || undefined, per_page: PAGE_SIZE });

  const results = createQuery(() => ({
    queryKey: queryKeys.commits.list(params),
    queryFn: ({ signal }) => commitsApi.list(params, signal),
    enabled: projectId !== null && !disabled,
    placeholderData: keepPreviousData,
  }));

  const options = $derived((results.data?.data ?? []).map(commitOption));
  const inOptions = $derived(value !== null && options.some((option) => option.value === value));
  const knownSelection = $derived(selected && selected.id === value ? selected : null);

  // Label for a preselected commit that is neither in the result page nor passed in.
  const current = createQuery(() => ({
    queryKey: queryKeys.commits.detail(value ?? ''),
    queryFn: ({ signal }) => commitsApi.get(value as string, signal),
    enabled: value !== null && !inOptions && knownSelection === null,
    staleTime: 60_000,
  }));

  const selectedLabel = $derived.by(() => {
    const commit = knownSelection ?? current.data;
    return commit && commit.id === value ? commitOption(commit).label : undefined;
  });
</script>

<Combobox
  {options}
  bind:value
  {onchange}
  {id}
  {selectedLabel}
  placeholder={projectId === null ? 'Choose a project first' : placeholder}
  searchPlaceholder="Search by hash, message or branch…"
  emptyText={search ? 'No commits match.' : 'No commits recorded for this project yet.'}
  onsearch={(query) => (search = query)}
  loading={results.isPending && results.fetchStatus === 'fetching'}
  disabled={disabled || projectId === null}
  aria-invalid={ariaInvalid === true || ariaInvalid === 'true' ? 'true' : undefined}
  aria-describedby={ariaDescribedBy}
  class={className}
/>
