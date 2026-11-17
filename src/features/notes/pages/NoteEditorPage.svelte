<!--
  Note editor for `/notes/new` (create) and `/notes/:noteId/edit` (autosave).

  Create: nothing is sent until the user creates the note (button or
  Ctrl/Cmd+S); a draft with content is saved when leaving the page so work is
  never lost. Edit: every change is autosaved ~1 s after the last keystroke —
  see `autosave.svelte.ts` for the guarantees.
-->
<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
  import LoaderIcon from '@lucide/svelte/icons/loader-circle';
  import TrashIcon from '@lucide/svelte/icons/trash';
  import { apiFieldErrors, errorMessage, queryKeys, type FieldErrors } from '$lib/api';
  import {
    confirm,
    DetailSkeleton,
    ErrorState,
    FormField,
    isEmptyDoc,
    PageHeader,
    RichTextEditor,
    toast,
    toastError,
    toDoc,
  } from '$lib/components';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import { navigate, router, setPageTitle } from '$lib/router';
  import { EMPTY_DOC, type RichTextDoc } from '$lib/types';
  import { paths } from '$routes/paths';
  import ProjectSelect from '$features/projects/components/ProjectSelect.svelte';
  import TagPicker from '$features/tags/components/TagPicker.svelte';
  import type { TagRef } from '$features/tags/types';
  import { notesApi } from '../api';
  import { NoteAutosave, type NoteDraft } from '../autosave.svelte';
  import SaveStatus from '../components/SaveStatus.svelte';
  import type { CreateNoteInput, NoteDetail, UpdateNoteInput } from '../types';
  import { categoryError, NOTE_CATEGORY_MAX, NOTE_TITLE_MAX, titleError } from '../validation';

  let { noteId }: { noteId?: string } = $props();

  // The page is re-created whenever the pathname changes, so the mode is fixed
  // for the lifetime of this component.
  // svelte-ignore state_referenced_locally
  const editId = noteId;
  const isNew = editId === undefined;

  const queryClient = useQueryClient();
  const categoryListId = $props.id();

  // ---- Local editor state (the source of truth while the page is open) ----
  let title = $state('');
  let projectId = $state<string | null>(isNew ? router.query.get('project_id') : null);
  let category = $state('');
  let isPinned = $state(false);
  let tagIds = $state<string[]>([]);
  let content = $state.raw<RichTextDoc>(structuredClone(EMPTY_DOC));
  /** Labels for tags that are already attached. */
  let attachedTags = $state.raw<TagRef[]>([]);

  const draft = (): NoteDraft => ({
    title,
    project_id: projectId,
    category,
    is_pinned: isPinned,
    tag_ids: tagIds,
    content_json: content,
  });

  // ---- Loading (edit mode) ----
  let loadState = $state<'loading' | 'error' | 'ready'>(isNew ? 'ready' : 'loading');
  let loadError = $state.raw<unknown>(null);
  let autosave = $state.raw<NoteAutosave<NoteDetail> | null>(null);
  let deleted = false;

  function invalidateAfterSave(patch: UpdateNoteInput | CreateNoteInput) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.notes.lists() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.notes.categories() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    if (patch.tag_ids !== undefined) void queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
    if (patch.project_id !== undefined) void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
  }

  async function load(id: string) {
    loadState = 'loading';
    try {
      // Always start from what the server has now, not from a cached copy.
      const note = await queryClient.fetchQuery({
        queryKey: queryKeys.notes.detail(id),
        queryFn: ({ signal }) => notesApi.get(id, signal),
        staleTime: 0,
      });
      title = note.title;
      projectId = note.project_id ?? null;
      category = note.category ?? '';
      isPinned = note.is_pinned;
      tagIds = note.tags.map((tag) => tag.id);
      attachedTags = note.tags;
      content = toDoc(note.content_json);
      autosave = new NoteAutosave<NoteDetail>({
        baseline: draft(),
        read: draft,
        save: (patch) => notesApi.update(id, patch),
        onsaved: (saved, patch) => {
          // Refresh the cache for the reading view. Local editor state is
          // deliberately left untouched: the response may be older than it.
          queryClient.setQueryData(queryKeys.notes.detail(id), saved);
          attachedTags = saved.tags;
          invalidateAfterSave(patch);
        },
      });
      loadState = 'ready';
    } catch (error) {
      loadError = error;
      loadState = 'error';
    }
  }

  onMount(() => {
    if (editId) void load(editId);
  });

  $effect(() => {
    setPageTitle(isNew ? 'New note' : title.trim() ? `Edit: ${title.trim()}` : 'Edit note');
  });

  // ---- Change tracking ----
  let createDirty = $state(false);
  /** Set once the user tried to create, so validation messages may show. */
  let createAttempted = $state(false);

  function changed() {
    if (isNew) createDirty = true;
    else autosave?.touch();
  }

  const serverErrors = $derived<FieldErrors>(
    autosave?.status === 'error' ? apiFieldErrors(autosave.error) : {},
  );
  let createErrors = $state<FieldErrors>({});

  const titleMessage = $derived(
    (isNew ? createAttempted : loadState === 'ready') ? titleError(title) : null,
  );
  const categoryMessage = $derived(categoryError(category));
  const fieldErrors = $derived<FieldErrors>({ ...serverErrors, ...createErrors });

  // ---- Create mode ----
  let created = false;
  let discarded = false;

  function createInput(fallbackTitle?: string): CreateNoteInput {
    return {
      title: title.trim() || fallbackTitle || '',
      project_id: projectId,
      category: categoryError(category) === null ? category.trim() || null : null,
      is_pinned: isPinned,
      tag_ids: tagIds,
      content_json: content,
    };
  }

  const create = createMutation(() => ({
    mutationFn: (input: CreateNoteInput) => notesApi.create(input),
    onSuccess: (note, input) => {
      created = true;
      queryClient.setQueryData(queryKeys.notes.detail(note.id), note);
      invalidateAfterSave(input);
      toast.success('Note created');
      // From here on the note has an id and every change autosaves.
      navigate(paths.noteEdit(note.id), { replace: true });
    },
    onError: (error) => {
      createErrors = apiFieldErrors(error);
      toastError(error, 'Could not create the note.');
    },
  }));

  function createNote() {
    if (create.isPending) return;
    createAttempted = true;
    createErrors = {};
    if (titleError(title) !== null || categoryError(category) !== null) return;
    create.mutate(createInput());
  }

  function discard() {
    discarded = true;
    router.back(paths.notes());
  }

  // ---- Edit mode actions ----
  async function saveNow() {
    if (isNew) createNote();
    else await autosave?.flush();
  }

  async function done() {
    if (!editId || !autosave) return;
    await autosave.flush();
    // Stay on the page when something could not be saved.
    if (autosave.status === 'saved') navigate(paths.note(editId));
  }

  const remove = createMutation(() => ({
    mutationFn: (id: string) => notesApi.remove(id),
    onSuccess: (_result, id) => {
      deleted = true;
      autosave?.dispose();
      queryClient.removeQueries({ queryKey: queryKeys.notes.detail(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notes.lists() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notes.categories() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      toast.success('Note deleted');
      navigate(paths.notes(), { replace: true });
    },
    onError: (error) => toastError(error, 'Could not delete the note.'),
  }));

  async function deleteNote() {
    if (!editId) return;
    const ok = await confirm({
      title: `Delete “${title.trim() || 'this note'}”?`,
      description: 'The note and its content are removed permanently.',
      confirmLabel: 'Delete note',
      destructive: true,
    });
    if (ok) remove.mutate(editId);
  }

  // ---- Leaving the page ----
  function hasUnsavedWork(): boolean {
    if (isNew) return createDirty && !created && !discarded;
    return Boolean(autosave?.busy) && !deleted;
  }

  function onbeforeunload(event: BeforeUnloadEvent) {
    if (!hasUnsavedWork()) return;
    event.preventDefault();
    // Legacy browsers need a value to show the prompt.
    event.returnValue = '';
  }

  function onkeydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 's') {
      event.preventDefault();
      void saveNow();
    }
  }

  function onvisibilitychange() {
    // Tab hidden or closing: do not wait for the debounce.
    if (document.visibilityState === 'hidden' && !deleted) void autosave?.flushValid();
  }

  onDestroy(() => {
    if (isNew) {
      // In-app navigation away from an uncreated draft: keep the work.
      const worthKeeping = title.trim() !== '' || !isEmptyDoc(content);
      if (!created && !discarded && !create.isPending && createDirty && worthKeeping && titleError(title.trim() || 'x') === null) {
        const input = createInput('Untitled note');
        notesApi
          .create(input)
          .then((note) => {
            invalidateAfterSave(input);
            toast.success(`Draft saved as “${note.title}”`);
          })
          .catch((error: unknown) => toastError(error, 'Could not save the draft.'));
      }
      return;
    }
    if (!deleted) void autosave?.flushValid();
    autosave?.dispose();
  });

  // Category suggestions.
  const categories = createQuery(() => ({
    queryKey: queryKeys.notes.categories(),
    queryFn: ({ signal }) => notesApi.categories({}, signal),
  }));
</script>

<svelte:window {onbeforeunload} {onkeydown} />
<svelte:document {onvisibilitychange} />

<div class="page">
  <PageHeader
    title={isNew ? 'New note' : 'Edit note'}
    breadcrumbs={[
      { label: 'Notes', href: paths.notes() },
      ...(editId ? [{ label: title.trim() || 'Note', href: paths.note(editId) }] : []),
      { label: isNew ? 'New' : 'Edit' },
    ]}
  >
    {#snippet meta()}
      {#if isNew}
        <span role="status" aria-live="polite" class="text-muted-foreground text-xs">
          {#if create.isPending}
            Creating…
          {:else if createDirty}
            Not saved yet — create the note to keep it
          {:else}
            Nothing is saved until you create the note
          {/if}
        </span>
      {:else if autosave}
        <SaveStatus
          status={autosave.status}
          savedAt={autosave.savedAt}
          invalidText={titleMessage ? 'Not saved — add a title' : 'Not saved — fix the highlighted field'}
          onretry={() => void autosave?.retry()}
        />
      {/if}
    {/snippet}
    {#snippet actions()}
      {#if isNew}
        <Button variant="outline" onclick={discard} disabled={create.isPending}>Discard</Button>
        <Button onclick={createNote} disabled={create.isPending}>
          {#if create.isPending}
            <LoaderIcon class="animate-spin" aria-hidden="true" />
          {/if}
          Create note
        </Button>
      {:else if loadState === 'ready'}
        <Button
          variant="outline"
          class="text-danger hover:text-danger"
          onclick={deleteNote}
          disabled={remove.isPending}
        >
          <TrashIcon aria-hidden="true" />
          Delete
        </Button>
        <Button onclick={done}>Done</Button>
      {/if}
    {/snippet}
  </PageHeader>

  {#if loadState === 'loading'}
    <DetailSkeleton header={false} />
  {:else if loadState === 'error'}
    <ErrorState error={loadError} onretry={() => editId && void load(editId)} />
  {:else}
    {#if autosave?.status === 'error'}
      <div role="alert" class="border-danger/30 bg-danger/10 text-danger mb-4 rounded-lg border px-3 py-2 text-sm">
        Could not save: {errorMessage(autosave.error, 'the server could not be reached')}. Your changes are kept on
        this page — keep editing or retry.
      </div>
    {/if}

    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div class="flex min-w-0 flex-col gap-4">
        <FormField label="Title" error={titleMessage ?? fieldErrors.title} required>
          {#snippet children(field)}
            <Input
              {...field}
              bind:value={title}
              oninput={changed}
              maxlength={NOTE_TITLE_MAX}
              placeholder="Deploy runbook"
              class="h-10 text-base font-medium md:text-base"
              autocomplete="off"
              autofocus={isNew}
            />
          {/snippet}
        </FormField>

        <FormField label="Content" error={fieldErrors.content_json} hideLabel>
          {#snippet children(field)}
            <RichTextEditor
              value={content}
              onchange={(doc) => {
                content = doc;
                changed();
              }}
              label="Note content"
              placeholder="Write the note… Use the toolbar for headings, lists, checklists, tables and code blocks."
              minHeight="28rem"
              invalid={field['aria-invalid'] === 'true'}
              describedBy={field['aria-describedby']}
            />
          {/snippet}
        </FormField>
        <p class="text-muted-foreground text-xs">
          {#if isNew}
            Press Ctrl/⌘ + S to create the note.
          {:else}
            Changes save automatically. Press Ctrl/⌘ + S to save immediately.
          {/if}
        </p>
      </div>

      <aside aria-label="Note properties" class="bg-card flex h-fit flex-col gap-4 rounded-lg border p-4">
        <FormField
          label="Project"
          error={fieldErrors.project_id}
          hint="Leave empty for a global note that belongs to no project."
        >
          {#snippet children(field)}
            <ProjectSelect
              {...field}
              bind:value={projectId}
              onchange={changed}
              placeholder="Global (no project)"
              clearable
              includeArchived
            />
          {/snippet}
        </FormField>

        <FormField label="Category" error={categoryMessage ?? fieldErrors.category} optional>
          {#snippet children(field)}
            <Input
              {...field}
              bind:value={category}
              oninput={changed}
              list={categoryListId}
              maxlength={NOTE_CATEGORY_MAX}
              placeholder="Runbooks, Decisions…"
              autocomplete="off"
            />
          {/snippet}
        </FormField>
        <datalist id={categoryListId}>
          {#each categories.data ?? [] as item (item.category)}
            <option value={item.category}></option>
          {/each}
        </datalist>

        <FormField label="Tags" error={fieldErrors.tag_ids} optional>
          {#snippet children(field)}
            <TagPicker {...field} bind:values={tagIds} selected={attachedTags} onchange={changed} />
          {/snippet}
        </FormField>

        <FormField label="Pinned" hint="Pinned notes are listed first.">
          {#snippet children(field)}
            <Switch {...field} bind:checked={isPinned} onCheckedChange={changed} />
          {/snippet}
        </FormField>
      </aside>
    </div>
  {/if}
</div>
