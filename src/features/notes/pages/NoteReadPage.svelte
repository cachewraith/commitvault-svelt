<!-- Reading view of a note: clean typography, no editing chrome. -->
<script lang="ts">
  import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import PinIcon from '@lucide/svelte/icons/pin';
  import PinOffIcon from '@lucide/svelte/icons/pin-off';
  import TrashIcon from '@lucide/svelte/icons/trash';
  import { queryKeys } from '$lib/api';
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
  import CodeCopyOverlay from '../components/CodeCopyOverlay.svelte';
  import type { NoteDetail } from '../types';

  let { noteId }: { noteId: string } = $props();

  const queryClient = useQueryClient();

  const query = createQuery(() => ({
    queryKey: queryKeys.notes.detail(noteId),
    queryFn: ({ signal }) => notesApi.get(noteId, signal),
  }));
  const note = $derived(query.data);

  $effect(() => {
    setPageTitle(note?.title ?? 'Note');
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
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.notes.detail(noteId) });
      invalidateLists();
      void queryClient.invalidateQueries({ queryKey: queryKeys.notes.categories() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      toast.success('Note deleted');
      navigate(paths.notes(), { replace: true });
    },
    onError: (error) => toastError(error, 'Could not delete the note.'),
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

<div class="page">
  {#if query.isPending}
    <DetailSkeleton />
  {:else if query.isError}
    <PageHeader title="Note" breadcrumbs={[{ label: 'Notes', href: paths.notes() }, { label: 'Note' }]} />
    <ErrorState error={query.error} onretry={() => query.refetch()} retrying={query.isFetching} />
  {:else if note}
    <PageHeader
      title={note.title}
      breadcrumbs={[{ label: 'Notes', href: paths.notes() }, { label: note.title }]}
    >
      {#snippet meta()}
        {#if note.is_pinned}
          <span class="border-brand/25 bg-brand/10 text-brand inline-flex h-5 items-center gap-1 rounded-md border px-1.5 text-xs font-medium">
            <PinIcon class="size-3" aria-hidden="true" />
            Pinned
          </span>
        {/if}
      {/snippet}
      {#snippet actions()}
        <Button
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
          variant="outline"
          class="text-danger hover:text-danger"
          disabled={remove.isPending}
          onclick={() => deleteNote(note)}
        >
          <TrashIcon aria-hidden="true" />
          Delete
        </Button>
        <Button href={paths.noteEdit(note.id)}>
          <PencilIcon aria-hidden="true" />
          Edit
        </Button>
      {/snippet}
    </PageHeader>

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
