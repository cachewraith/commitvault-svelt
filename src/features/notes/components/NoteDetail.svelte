<!-- Reading view of a note: clean typography, no editing chrome. Full page or side panel. -->
<script lang="ts">
  import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import PinIcon from '@lucide/svelte/icons/pin';
  import PinOffIcon from '@lucide/svelte/icons/pin-off';
  import TrashIcon from '@lucide/svelte/icons/trash';
  import { queryKeys, removeFromCache } from '$lib/api';
  import {
    confirm,
    DateTime,
    DetailSkeleton,
    ErrorState,
    PageHeader,
    RichTextViewer,
    TagBadge,
    toast,
    toastError,
  } from '$lib/components';
  import { Button } from '$lib/components/ui/button';
  import { navigate, setPageTitle } from '$lib/router';
  import { paths } from '$routes/paths';
  import { notesApi } from '../api';
  import CodeCopyOverlay from './CodeCopyOverlay.svelte';
  import type { NoteDetail } from '../types';

  interface Props {
    noteId: string;
    layout?: 'page' | 'panel';
    /** After a successful delete. Default: go to the note list. */
    ondeleted?: () => void;
  }

  let { noteId, layout = 'page', ondeleted }: Props = $props();
  const isPage = $derived(layout === 'page');

  const queryClient = useQueryClient();

  const query = createQuery(() => ({
    queryKey: queryKeys.notes.detail(noteId),
    queryFn: ({ signal }) => notesApi.get(noteId, signal),
  }));
  const note = $derived(query.data);

  $effect(() => {
    if (isPage) setPageTitle(note?.title ?? 'Note');
  });

  function invalidateLists() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.notes.lists() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
  }

  const togglePin = createMutation(() => ({
    mutationFn: (pinned: boolean) => notesApi.update(noteId, { is_pinned: pinned }),
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.notes.detail(noteId), saved);
      invalidateLists();
      toast.success(saved.is_pinned ? 'Note pinned' : 'Note unpinned');
    },
    onError: (error) => toastError(error, 'Could not update the note.'),
  }));

  const remove = createMutation(() => ({
    mutationFn: () => notesApi.remove(noteId),
    // Optimistic: gone from every list at once; restored if the server refuses.
    onMutate: () => {
      const restore = removeFromCache(queryClient, noteId, [queryKeys.notes.lists(), queryKeys.dashboard.all]);
      toast.success('Note deleted');
      if (ondeleted) ondeleted();
      else navigate(paths.notes(), { replace: true });
      return { restore };
    },
    onSuccess: () => queryClient.removeQueries({ queryKey: queryKeys.notes.detail(noteId) }),
    onError: (error, _input, context) => {
      context?.restore();
      toastError(error, 'Could not delete the note. It is back in the list.');
    },
    onSettled: () => {
      invalidateLists();
      void queryClient.invalidateQueries({ queryKey: queryKeys.notes.categories() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  }));

  async function deleteNote(current: NoteDetail) {
    const ok = await confirm({
      title: `Delete “${current.title}”?`,
      description: 'The note and its content are removed permanently.',
      confirmLabel: 'Delete note',
      destructive: true,
    });
    if (ok) remove.mutate();
  }
</script>

<div>
  {#if query.isPending}
    <DetailSkeleton />
  {:else if query.isError}
    {#if isPage}
      <PageHeader title="Note" breadcrumbs={[{ label: 'Notes', href: paths.notes() }, { label: 'Note' }]} />
    {/if}
    <ErrorState error={query.error} onretry={() => query.refetch()} retrying={query.isFetching} />
  {:else if note}
    {#snippet metaLine()}
    {#if note.is_pinned}
      <span class="border-brand/25 bg-brand/10 text-brand inline-flex h-5 items-center gap-1 rounded-md border px-1.5 text-xs font-medium">
        <PinIcon class="size-3" aria-hidden="true" />
        Pinned
      </span>
    {/if}
    {/snippet}
    {#snippet actionButtons(compact: boolean)}
    <Button
      size={compact ? 'sm' : 'default'}
      variant="outline"
      disabled={togglePin.isPending}
      onclick={() => togglePin.mutate(!note.is_pinned)}
    >
      {#if note.is_pinned}
        <PinOffIcon aria-hidden="true" />
        Unpin
      {:else}
        <PinIcon aria-hidden="true" />
        Pin
      {/if}
    </Button>
    <Button
      size={compact ? 'sm' : 'default'}
      variant="outline"
      class="text-danger hover:text-danger"
      disabled={remove.isPending}
      onclick={() => deleteNote(note)}
    >
      <TrashIcon aria-hidden="true" />
      Delete
    </Button>
    <Button size={compact ? 'sm' : 'default'} href={paths.noteEdit(note.id)}>
      <PencilIcon aria-hidden="true" />
      Edit
    </Button>
    {/snippet}

    {#if isPage}
      <PageHeader
        title={note.title}
        breadcrumbs={[{ label: 'Notes', href: paths.notes() }, { label: note.title }]}
      >
        {#snippet meta()}
          {@render metaLine()}
        {/snippet}
        {#snippet actions()}
          {@render actionButtons(false)}
        {/snippet}
      </PageHeader>
    {:else}
      <header class="mb-5 flex flex-col gap-3">
        <h2 class="text-foreground text-lg font-semibold break-words">{note.title}</h2>
        {@render metaLine()}
        <div class="flex flex-wrap gap-2">{@render actionButtons(true)}</div>
      </header>
    {/if}

    <article class="mx-auto w-full max-w-3xl">
      <dl class="text-muted-foreground mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-b pb-4 text-sm">
        <div class="flex items-center gap-1.5">
          <dt class="eyebrow">Project</dt>
          <dd>
            {#if note.project}
              <a href={paths.project(note.project.id)} class="text-brand hover:underline">{note.project.name}</a>
            {:else}
              Global
            {/if}
          </dd>
        </div>
        {#if note.category}
          <div class="flex items-center gap-1.5">
            <dt class="eyebrow">Category</dt>
            <dd>
              <a href={paths.notes({ category: note.category })} class="hover:text-foreground hover:underline">
                {note.category}
              </a>
            </dd>
          </div>
        {/if}
        <div class="flex items-center gap-1.5">
          <dt class="eyebrow">Updated</dt>
          <dd class="tabular"><DateTime value={note.updated_at} mode="both" /></dd>
        </div>
        {#if note.tags.length > 0}
          <div class="flex items-center gap-1.5">
            <dt class="eyebrow">Tags</dt>
            <dd class="flex flex-wrap gap-1">
              {#each note.tags as tag (tag.id)}
                <TagBadge name={tag.name} color={tag.color} href={paths.notes({ tag_id: tag.id })} />
              {/each}
            </dd>
          </div>
        {/if}
      </dl>

      <CodeCopyOverlay>
        <RichTextViewer value={note.content_json} emptyText="This note is empty. Choose Edit to start writing." />
      </CodeCopyOverlay>
    </article>
  {/if}
</div>
