<!--
  Create or edit a release: version, title, status, date, description,
  rich-text notes, associated commits and tags.

  The form keeps everything the user typed when validation or the request
  fails; server-side field errors (409 duplicate version, 422 commit_ids /
  release_notes / tag_ids) are shown next to the matching control.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { createMutation, useQueryClient } from '@tanstack/svelte-query';
  import LoaderIcon from '@lucide/svelte/icons/loader-circle';
  import { apiFieldErrors, isApiError, queryKeys, type FieldErrors } from '$lib/api';
  import { FormField, isEmptyDoc, RichTextEditor, toast, toastError, toDoc } from '$lib/components';
  import { Button } from '$lib/components/ui/button';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import * as Select from '$lib/components/ui/select';
  import { Textarea } from '$lib/components/ui/textarea';
  import { RELEASE_STATUSES, type RichTextDoc } from '$lib/types';
  import { toDateTimeInputValue } from '$lib/utils/format';
  import { validateForm } from '$lib/validators';
  import CommitMultiPicker from '$features/commits/components/CommitMultiPicker.svelte';
  import ProjectSelect from '$features/projects/components/ProjectSelect.svelte';
  import TagPicker from '$features/tags/components/TagPicker.svelte';
  import { releasesApi } from '../api';
  import type { CreateReleaseInput, ReleaseDetail, ReleaseStatus, UpdateReleaseInput } from '../types';
  import { looksLikeSemver, releaseSchema } from '../validation';

  interface Props {
    open?: boolean;
    /** Pre-selects and locks the project when creating. */
    projectId?: string;
    /** Edit this release; omit to create. */
    release?: ReleaseDetail;
    onsaved?: (release: ReleaseDetail) => void;
  }

  let { open = $bindable(false), projectId, release, onsaved }: Props = $props();

  const queryClient = useQueryClient();
  const editing = $derived(release !== undefined);

  const STATUS_LABELS: Record<ReleaseStatus, string> = {
    draft: 'Draft',
    released: 'Released',
    deprecated: 'Deprecated',
  };

  let values = $state({
    project_id: '',
    version: '',
    title: '',
    status: 'draft' as ReleaseStatus,
    released_at: '',
    description: '',
  });
  let notes = $state.raw<RichTextDoc | null>(null);
  let commitIds = $state<string[]>([]);
  let tagIds = $state<string[]>([]);
  /** Field errors reported by the server for the last submitted values. */
  let serverErrors = $state<FieldErrors>({});
  /** After the first submit attempt, client validation follows the input live. */
  let attempted = $state(false);
  let formError = $state<string | null>(null);

  const errors = $derived<FieldErrors>({
    ...serverErrors,
    ...(attempted ? validateForm(releaseSchema, values).errors : {}),
  });

  /** A server-side complaint about a field is stale once that field changes. */
  function touched(field: string) {
    if (serverErrors[field]) {
      const { [field]: _stale, ...rest } = serverErrors;
      serverErrors = rest;
    }
  }

  // (Re)initialise the form each time the dialog opens — never while it is
  // open, so a background refetch cannot overwrite what the user is typing.
  $effect(() => {
    if (!open) return;
    untrack(() => {
      values = {
        project_id: release?.project_id ?? projectId ?? '',
        version: release?.version ?? '',
        title: release?.title ?? '',
        status: release?.status ?? 'draft',
        released_at: release?.released_at ? toDateTimeInputValue(release.released_at) : '',
        description: release?.description ?? '',
      };
      notes = release?.release_notes ? toDoc($state.snapshot(release.release_notes)) : null;
      commitIds = release?.commits.map((commit) => commit.id) ?? [];
      tagIds = release?.tags.map((tag) => tag.id) ?? [];
      serverErrors = {};
      attempted = false;
      formError = null;
    });
  });

  const projectLocked = $derived(editing || projectId !== undefined);
  const semverHint = $derived(
    values.version.trim() !== '' && !looksLikeSemver(values.version)
      ? 'Not a semantic version — that is fine, any label that is unique in the project works.'
      : 'Any label works. Semantic versions such as 1.4.0 are supported but not required.',
  );
  const releasedAtHint = $derived(
    values.status === 'released' && values.released_at === ''
      ? 'Leave empty to use the moment the release is saved.'
      : 'Optional. Drafts can carry a planned date.',
  );

  function changeProject(next: string | null) {
    if ((next ?? '') === values.project_id) return;
    values.project_id = next ?? '';
    // Commits belong to one project; a different project invalidates the selection.
    commitIds = [];
    touched('project_id');
    touched('commit_ids');
  }

  const save = createMutation(() => ({
    mutationFn: (input: { projectId: string; body: CreateReleaseInput & UpdateReleaseInput }) =>
      release
        ? releasesApi.update(release.id, input.body)
        : releasesApi.create(input.projectId, input.body as CreateReleaseInput),
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.releases.detail(saved.id), saved);
      for (const key of [
        queryKeys.releases.all,
        // Commits list the releases they belong to; projects and tags show counts.
        queryKeys.commits.all,
        queryKeys.projects.all,
        queryKeys.tags.all,
        queryKeys.dashboard.all,
      ]) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      toast.success(editing ? `Release ${saved.version} updated` : `Release ${saved.version} created`);
      open = false;
      onsaved?.(saved as ReleaseDetail);
    },
    onError: (error) => {
      // Keep everything as typed; only report what went wrong.
      const fieldErrors = apiFieldErrors(error);
      serverErrors = fieldErrors;
      if (Object.keys(fieldErrors).length > 0) {
        formError = null;
        if (isApiError(error) && error.isConflict) toast.error('That version is already used in this project.');
        else toastError(error);
      } else {
        formError = isApiError(error) ? error.message : 'Could not save the release. Please try again.';
      }
    },
  }));

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (save.isPending) return;
    formError = null;
    attempted = true;
    serverErrors = {};

    const result = validateForm(releaseSchema, values);
    if (!result.ok) return;

    const { project_id, ...fields } = result.data;
    save.mutate({
      projectId: project_id,
      body: {
        ...fields,
        release_notes: isEmptyDoc(notes) ? null : notes,
        commit_ids: commitIds,
        tag_ids: tagIds,
      },
    });
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content
    class="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-3xl"
    interactOutsideBehavior="ignore"
  >
    <Dialog.Header class="border-b px-5 py-4">
      <Dialog.Title>{editing ? `Edit release ${release?.version ?? ''}` : 'New release'}</Dialog.Title>
      <Dialog.Description>
        A release is a manual record: a version, what it contains and the commits that belong to it.
      </Dialog.Description>
    </Dialog.Header>

    <form onsubmit={submit} novalidate class="flex min-h-0 flex-1 flex-col">
      <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4" style="--header-height: 0px">
        {#if formError}
          <div role="alert" class="border-danger/30 bg-danger/10 text-danger rounded-lg border px-3 py-2 text-sm">
            {formError}
          </div>
        {/if}

        <FormField
          label="Project"
          error={errors.project_id}
          required
          hint={projectLocked ? undefined : 'Commits can only be added from this project.'}
        >
          {#snippet children(field)}
            {#if release}
              <p id={field.id} class="bg-muted text-muted-foreground flex h-8 items-center rounded-lg border px-2.5 text-sm">
                {release.project.name}
              </p>
            {:else}
              <ProjectSelect
                {...field}
                value={values.project_id || null}
                onchange={changeProject}
                disabled={projectLocked || save.isPending}
                placeholder="Select a project"
              />
            {/if}
          {/snippet}
        </FormField>

        <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <FormField label="Version" error={errors.version} required hint={semverHint}>
            {#snippet children(field)}
              <Input
                {...field}
                bind:value={values.version}
                oninput={() => touched('version')}
                maxlength={64}
                placeholder="1.4.0"
                class="font-mono"
                autocomplete="off"
                spellcheck={false}
              />
            {/snippet}
          </FormField>
          <FormField label="Title" error={errors.title} required>
            {#snippet children(field)}
              <Input {...field} bind:value={values.title} maxlength={200} placeholder="Spring release" />
            {/snippet}
          </FormField>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <FormField label="Status" error={errors.status}>
            {#snippet children(field)}
              <Select.Root
                type="single"
                value={values.status}
                onValueChange={(next) => (values.status = next as ReleaseStatus)}
              >
                <Select.Trigger {...field} class="w-full">{STATUS_LABELS[values.status]}</Select.Trigger>
                <Select.Content>
                  {#each RELEASE_STATUSES as status (status)}
                    <Select.Item value={status} label={STATUS_LABELS[status]} />
                  {/each}
                </Select.Content>
              </Select.Root>
            {/snippet}
          </FormField>
          <FormField label="Released at" error={errors.released_at} optional hint={releasedAtHint}>
            {#snippet children(field)}
              <Input {...field} type="datetime-local" bind:value={values.released_at} class="tabular" />
            {/snippet}
          </FormField>
        </div>

        <FormField label="Description" error={errors.description} optional hint="A short summary shown in lists.">
          {#snippet children(field)}
            <Textarea {...field} bind:value={values.description} rows={2} maxlength={5000} />
          {/snippet}
        </FormField>

        <FormField label="Release notes" error={errors.release_notes} optional>
          {#snippet children(field)}
            <RichTextEditor
              value={notes}
              onchange={(doc) => {
                notes = doc;
                touched('release_notes');
              }}
              label="Release notes"
              placeholder="What changed, upgrade steps, known issues…"
              minHeight="10rem"
              invalid={field['aria-invalid'] === 'true'}
              describedBy={field['aria-describedby']}
              disabled={save.isPending}
            />
          {/snippet}
        </FormField>

        <FormField
          label="Commits"
          error={errors.commit_ids}
          optional
          hint="Commits recorded for this project that are part of the release."
        >
          {#snippet children(field)}
            {#if values.project_id}
              <CommitMultiPicker
                {...field}
                projectId={values.project_id}
                bind:values={commitIds}
                onchange={() => touched('commit_ids')}
                selected={release?.commits ?? []}
                disabled={save.isPending}
              />
            {:else}
              <p id={field.id} class="text-muted-foreground rounded-lg border border-dashed px-3 py-2 text-sm">
                Choose a project to pick its commits.
              </p>
            {/if}
          {/snippet}
        </FormField>

        <FormField label="Tags" error={errors.tag_ids} optional>
          {#snippet children(field)}
            <TagPicker
              {...field}
              bind:values={tagIds}
              onchange={() => touched('tag_ids')}
              selected={release?.tags ?? []}
              disabled={save.isPending}
            />
          {/snippet}
        </FormField>
      </div>

      <Dialog.Footer class="mx-0 mb-0 px-5 py-3">
        <Button type="button" variant="outline" onclick={() => (open = false)} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {#if save.isPending}
            <LoaderIcon class="animate-spin" aria-hidden="true" />
          {/if}
          {editing ? 'Save changes' : 'Create release'}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
