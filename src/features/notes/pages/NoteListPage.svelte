<!--
  Technical notes. Pinned notes come first (the API orders them). Filters,
  sort and page live in the URL: /notes?project_id=…&category=…&pinned=true
-->
<script lang="ts">
  import { createMutation, createQuery, keepPreviousData, useQueryClient } from '@tanstack/svelte-query';
  import NotebookIcon from '@lucide/svelte/icons/notebook-text';
  import PinIcon from '@lucide/svelte/icons/pin';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import { queryKeys, type Paginated } from '$lib/api';
  import {
    CardGridSkeleton,
    DateTime,
    EmptyState,
    ErrorState,
    FilterBar,
    PageHeader,
    Pagination,
    SearchInput,
    TagBadge,
    toastError,
  } from '$lib/components';
  import { Button } from '$lib/components/ui/button';
  import * as Select from '$lib/components/ui/select';
  import { queryBoolean, queryEnum, queryNumber, queryString, setQuery } from '$lib/router';
  import { cn } from '$lib/utils';
  import { paths } from '$routes/paths';
  import ProjectSelect from '$features/projects/components/ProjectSelect.svelte';
  import TagSelect from '$features/tags/components/TagSelect.svelte';
  import { notesApi, type NoteListParams } from '../api';
  import type { Note, NoteSort } from '../types';

  const SORTS = ['updated_at', 'created_at', 'title'] as const satisfies readonly NoteSort[];
  const SORT_LABELS: Record<NoteSort, string> = {
    updated_at: 'Recently updated',
    created_at: 'Recently created',
    title: 'Title A–Z',
  };

  const page = queryNumber('page', 1);
  const search = queryString('search');
  const projectId = queryString('project_id');
  const globalOnly = queryBoolean('global');
  const category = queryString('category');
  const pinnedOnly = queryBoolean('pinned');
  const tagId = queryString('tag_id');
  const sort = queryEnum('sort', SORTS, 'updated_at');

  const params = $derived<NoteListParams>({
    page: page.value,
    per_page: 24,
    search: search.value || undefined,
    project_id: projectId.value || undefined,
    global: globalOnly.value || undefined,
    category: category.value || undefined,
    pinned: pinnedOnly.value || undefined,
    tag_id: tagId.value || undefined,
    sort: sort.value,
  });

  const filtered = $derived(
    Boolean(search.value || projectId.value || globalOnly.value || category.value || pinnedOnly.value || tagId.value),
  );

  const queryClient = useQueryClient();

  const notes = createQuery(() => ({
    queryKey: queryKeys.notes.list(params),
    queryFn: ({ signal }) => notesApi.list(params, signal),
    placeholderData: keepPreviousData,
  }));

  const categories = createQuery(() => ({
    queryKey: queryKeys.notes.categories(),
    queryFn: ({ signal }) => notesApi.categories({}, signal),
  }));

  /** Scope select: all notes, global notes only, or (via the project picker) one project. */
  const scope = $derived(globalOnly.value ? 'global' : 'all');

  function resetFilters() {
    setQuery({
      search: null,
      project_id: null,
      global: null,
      category: null,
      pinned: null,
      tag_id: null,
      page: null,
    });
  }

  // Pin / unpin from the list, optimistically.
  const togglePin = createMutation(() => ({
    mutationFn: (note: Note) => notesApi.update(note.id, { is_pinned: !note.is_pinned }),
    onMutate: async (note: Note) => {
      const key = queryKeys.notes.list(params);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Paginated<Note>>(key);
      if (previous) {
        queryClient.setQueryData<Paginated<Note>>(key, {
          ...previous,
          data: previous.data.map((item) =>
            item.id === note.id ? { ...item, is_pinned: !note.is_pinned } : item,
          ),
        });
      }
      return { key, previous };
    },
    onError: (error, _note, context) => {
      if (context?.previous) queryClient.setQueryData(context.key, context.previous);
      toastError(error, 'Could not update the note.');
    },
    onSettled: (_data, _error, note) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notes.lists() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notes.detail(note.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  }));

  const newNoteHref = $derived(paths.noteNew({ project_id: projectId.value || undefined }));
</script>

<div class="page">
  <PageHeader
    title="Notes"
  >
    {#snippet actions()}
      <Button href={newNoteHref}>
        <PlusIcon aria-hidden="true" />
        New note
      </Button>
    {/snippet}
  </PageHeader>

  <FilterBar active={filtered} onreset={resetFilters} label="Note filters">
    <SearchInput
      value={search.value}
      onsearch={(q) => setQuery({ search: q, page: null })}
      label="Search notes"
      placeholder="Search titles and note text…"
      class="w-full sm:w-64"
    />
    <Select.Root
      type="single"
      value={scope}
      onValueChange={(next) =>
        setQuery({ global: next === 'global' ? 'true' : null, project_id: next === 'global' ? null : projectId.value, page: null })}
    >
      <Select.Trigger class="w-full sm:w-36" aria-label="Scope">
        {scope === 'global' ? 'Global only' : 'All notes'}
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="all" label="All notes" />
        <Select.Item value="global" label="Global only" />
      </Select.Content>
    </Select.Root>
    <ProjectSelect
      value={projectId.value || null}
      onchange={(id) => setQuery({ project_id: id, global: null, page: null })}
      placeholder="Any project"
      clearable
      includeArchived
      disabled={globalOnly.value}
      class="w-full sm:w-48"
    />
    <Select.Root
      type="single"
      value={category.value || '__all'}
      onValueChange={(next) => setQuery({ category: next === '__all' ? null : next, page: null })}
    >
      <Select.Trigger class="w-full sm:w-40" aria-label="Category">
        {category.value || 'Any category'}
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="__all" label="Any category" />
        {#each categories.data ?? [] as item (item.category)}
          <Select.Item value={item.category} label="{item.category} ({item.note_count})" />
        {/each}
      </Select.Content>
    </Select.Root>
    <TagSelect
      value={tagId.value || null}
      onchange={(id) => setQuery({ tag_id: id, page: null })}
      placeholder="Any tag"
      class="w-full sm:w-40"
    />
    <Button
      variant={pinnedOnly.value ? 'secondary' : 'outline'}
      aria-pressed={pinnedOnly.value}
      onclick={() => setQuery({ pinned: pinnedOnly.value ? null : 'true', page: null })}
    >
      <PinIcon aria-hidden="true" />
      Pinned only
    </Button>
    {#snippet actions()}
      <Select.Root
        type="single"
        value={sort.value}
        onValueChange={(next) => setQuery({ sort: next === 'updated_at' ? null : next, page: null })}
      >
        <Select.Trigger class="w-full sm:w-44" aria-label="Sort notes">{SORT_LABELS[sort.value]}</Select.Trigger>
        <Select.Content>
          {#each SORTS as value (value)}
            <Select.Item {value} label={SORT_LABELS[value]} />
          {/each}
        </Select.Content>
      </Select.Root>
    {/snippet}
  </FilterBar>

  {#if notes.isPending}
    <CardGridSkeleton count={6} />
  {:else if notes.isError}
    <ErrorState error={notes.error} onretry={() => notes.refetch()} retrying={notes.isFetching} />
  {:else if notes.data.data.length === 0}
    {#if filtered}
      <EmptyState
        icon={NotebookIcon}
        title="No notes match these filters"
        description="Search looks at titles, categories and the text of each note."
      >
        {#snippet action()}
          <Button variant="outline" onclick={resetFilters}>Clear filters</Button>
        {/snippet}
      </EmptyState>
    {:else}
      <EmptyState
        icon={NotebookIcon}
        title="No notes yet"
        description="Write down deployment steps, migration commands and technical decisions so they are easy to find later."
      >
        {#snippet action()}
          <Button href={newNoteHref}>
            <PlusIcon aria-hidden="true" />
            New note
          </Button>
        {/snippet}
      </EmptyState>
    {/if}
  {:else}
    <ul aria-label="Notes" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {#each notes.data.data as note (note.id)}
        <li class={cn('bg-card flex min-h-36 flex-col rounded-lg border p-4', note.is_pinned && 'border-brand/30')}>
          <div class="flex items-start gap-2">
            <h2 class="min-w-0 flex-1 text-sm font-semibold">
              <a href={paths.note(note.id)} class="line-clamp-2 hover:underline">{note.title}</a>
            </h2>
            <Button
              variant="ghost"
              size="icon-xs"
              class={note.is_pinned ? 'text-brand' : 'text-muted-foreground'}
              aria-pressed={note.is_pinned}
              aria-label={note.is_pinned ? `Unpin “${note.title}”` : `Pin “${note.title}”`}
              onclick={() => togglePin.mutate(note)}
            >
              <PinIcon class={note.is_pinned ? 'fill-current' : ''} aria-hidden="true" />
            </Button>
          </div>

          <p class="text-muted-foreground mt-1.5 line-clamp-3 flex-1 text-sm">
            {note.excerpt || 'No content yet.'}
          </p>

          {#if note.tags.length > 0}
            <div class="mt-3 flex flex-wrap gap-1">
              {#each note.tags as tag (tag.id)}
                <TagBadge name={tag.name} color={tag.color} />
              {/each}
            </div>
          {/if}

          <div class="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {#if note.project}
              <a href={paths.project(note.project.id)} class="hover:text-foreground max-w-[20ch] truncate">
                {note.project.name}
              </a>
            {:else}
              <span>Global</span>
            {/if}
            {#if note.category}
              <button
                type="button"
                class="bg-muted hover:text-foreground rounded-md px-1.5 py-px transition-colors"
                aria-label="Filter by category {note.category}"
                onclick={() => setQuery({ category: note.category, page: null })}
              >
                {note.category}
              </button>
            {/if}
            <DateTime value={note.updated_at} class="tabular ml-auto" />
          </div>
        </li>
      {/each}
    </ul>
    <Pagination
      meta={notes.data.meta}
      onchange={(next) => (page.value = next)}
      label="notes"
      hideWhenSinglePage
      class="mt-4"
    />
  {/if}
</div>
