<!--
  Searchable multi select of a project's commits (release → commits).
  `selected` supplies labels for ids that are already associated. The chosen
  commits are listed underneath with a remove button each.
-->
<script lang="ts">
  import { createQuery, keepPreviousData } from '@tanstack/svelte-query';
  import XIcon from '@lucide/svelte/icons/x';
  import { queryKeys } from '$lib/api';
  import { MultiCombobox } from '$lib/components';
  import { cn } from '$lib/utils/cn';
  import { commitsApi } from '../api';
  import { commitOption, commitSubject } from '../format';
  import type { Commit, CommitBrief } from '../types';

  interface Props {
    projectId: string;
    values?: string[];
    selected?: CommitBrief[];
    onchange?: (commitIds: string[]) => void;
    disabled?: boolean;
    id?: string;
    'aria-invalid'?: boolean | 'true' | 'false';
    'aria-describedby'?: string;
    class?: string;
  }

  let {
    projectId,
    values = $bindable([]),
    selected = [],
    onchange,
    disabled = false,
    id,
    'aria-invalid': ariaInvalid,
    'aria-describedby': ariaDescribedBy,
    class: className,
  }: Props = $props();

  const PAGE_SIZE = 25;
  /** Backend cap for one relation list (`MAX_IDS`). */
  const MAX_COMMITS = 500;
  let search = $state('');

  const params = $derived({ project_id: projectId, search: search || undefined, per_page: PAGE_SIZE });

  const results = createQuery(() => ({
    queryKey: queryKeys.commits.list(params),
    queryFn: ({ signal }) => commitsApi.list(params, signal),
    enabled: !disabled,
    placeholderData: keepPreviousData,
  }));

  // Every commit seen so far (passed in or returned by a search), so a chosen
  // commit keeps its label after the search text changes.
  let seen = $state.raw(new Map<string, Commit | CommitBrief>());
  $effect(() => {
    const incoming = [...selected, ...(results.data?.data ?? [])];
    if (incoming.every((commit) => seen.has(commit.id))) return;
    const next = new Map(seen);
    for (const commit of incoming) next.set(commit.id, commit);
    seen = next;
  });

  const options = $derived((results.data?.data ?? []).map(commitOption));
  const chosen = $derived(values.map((commitId) => seen.get(commitId)).filter((c): c is Commit | CommitBrief => !!c));
  const selectedOptions = $derived(chosen.map(commitOption));

  function remove(commitId: string) {
    values = values.filter((value) => value !== commitId);
    onchange?.(values);
  }
</script>

<div class={cn('flex flex-col gap-2', className)}>
  <MultiCombobox
    {options}
    bind:values
    {onchange}
    {selectedOptions}
    {id}
    max={MAX_COMMITS}
    placeholder="Add commits…"
    searchPlaceholder="Search by hash, message or branch…"
    emptyText={search ? 'No commits match.' : 'No commits recorded for this project yet.'}
    onsearch={(query) => (search = query)}
    loading={results.isPending && results.fetchStatus === 'fetching'}
    {disabled}
    aria-invalid={ariaInvalid === true || ariaInvalid === 'true' ? 'true' : undefined}
    aria-describedby={ariaDescribedBy}
  />

  {#if chosen.length > 0}
    <ul aria-label="Selected commits" class="bg-card max-h-56 divide-y overflow-y-auto rounded-lg border">
      {#each chosen as commit (commit.id)}
        <li class="flex items-center gap-2 px-2.5 py-1.5">
          <code class="text-foreground shrink-0 font-mono text-xs">{commit.short_hash}</code>
          <span class="text-muted-foreground min-w-0 flex-1 truncate text-xs">
            {commitSubject(commit.commit_message)}
          </span>
          {#if !disabled}
            <button
              type="button"
              class="text-muted-foreground hover:text-foreground flex size-5 shrink-0 items-center justify-center rounded-sm"
              aria-label="Remove commit {commit.short_hash}"
              onclick={() => remove(commit.id)}
            >
              <XIcon class="size-3.5" aria-hidden="true" />
            </button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>
