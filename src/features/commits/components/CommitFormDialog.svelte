<!--
  Record (no `commit`) or edit a commit in a dialog — the quick-create entry
  point used across the app. Without `projectId` the form starts with a
  project picker.

  CommitVault never talks to Git: everything here is typed or pasted by the
  user, so the form is tuned for that (hash normalisation, picking or adding a
  branch inline, "Record another").
-->
<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
  import { apiFieldErrors, queryKeys, type FieldErrors } from '$lib/api';
  import { FormField, toast, toastError } from '$lib/components';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';
  import { toDateTimeInputValue } from '$lib/utils/format';
  import { isCommitHash, shortHash } from '$lib/utils/hash';
  import { validateForm } from '$lib/validators';
  import { branchesApi } from '$features/branches/api';
  import BranchSelect from '$features/branches/components/BranchSelect.svelte';
  import { projectsApi } from '$features/projects/api';
  import ProjectSelect from '$features/projects/components/ProjectSelect.svelte';
  import TagPicker from '$features/tags/components/TagPicker.svelte';
  import { commitsApi } from '../api';
  import type { Commit } from '../types';
  import { commitFormSchema, normalizeHashInput, type CommitFormData } from '../validation';

  interface Props {
    open?: boolean;
    projectId?: string;
    /** Preselected branch for a new commit (requires `projectId`). */
    branchId?: string;
    /** Its name, shown until the picker has loaded it. */
    branchName?: string;
    commit?: Commit;
    onsaved?: (commit: Commit) => void;
  }

  let { open = $bindable(false), projectId, branchId, branchName, commit, onsaved }: Props = $props();

  const queryClient = useQueryClient();

  const isEdit = $derived(commit !== undefined);
  /** The project cannot change when it was given by the caller or the commit exists. */
  const projectLocked = $derived(isEdit || projectId !== undefined);

  function initialValues() {
    return {
      project_id: commit?.project_id ?? projectId ?? '',
      branch_id: commit?.branch_id ?? branchId ?? '',
      commit_hash: commit?.commit_hash ?? '',
      commit_message: commit?.commit_message ?? '',
      commit_date: toDateTimeInputValue(commit?.commit_date ?? new Date()),
      author_name: commit?.author_name ?? '',
      external_url: commit?.external_url ?? '',
      description: commit?.description ?? '',
      tag_ids: commit?.tags.map((tag) => tag.id) ?? [],
    };
  }

  let values = $state(initialValues());
  let errors = $state<FieldErrors>({});
  /** Name shown for the selected branch before the picker has loaded it. */
  let branchLabel = $state<string | undefined>(undefined);
  /** Once the user picks a branch we stop following the project's default branch. */
  let branchTouched = $state(false);
  let recordAnother = $state(false);
  let form = $state<HTMLFormElement | null>(null);
  let hashInput = $state<HTMLInputElement | null>(null);

  // (Re)initialise every time the dialog opens, so a cancelled edit never leaks
  // into the next use.
  let wasOpen = false;
  $effect(() => {
    const isOpen = open;
    if (isOpen && !wasOpen) {
      untrack(() => {
        values = initialValues();
        branchLabel = commit?.branch.name ?? branchName;
        errors = {};
        branchTouched = isEdit || branchId !== undefined;
        recordAnother = false;
      });
    }
    wasOpen = isOpen;
  });

  const project = createQuery(() => ({
    queryKey: queryKeys.projects.detail(values.project_id),
    queryFn: ({ signal }) => projectsApi.get(values.project_id, signal),
    enabled: open && values.project_id !== '',
    staleTime: 60_000,
  }));

  // The project's default branch, to preselect it for new commits.
  const defaultBranchParams = $derived({ search: project.data?.default_branch, per_page: 10 });
  const defaultBranch = createQuery(() => ({
    queryKey: queryKeys.branches.list({ projectId: values.project_id, ...defaultBranchParams }),
    queryFn: ({ signal }) => branchesApi.list(values.project_id, defaultBranchParams, signal),
    enabled: open && !branchTouched && project.data?.id === values.project_id,
    staleTime: 60_000,
  }));

  // New commits start on the project's default branch until the user picks one.
  $effect(() => {
    const found = defaultBranch.data?.data.find((branch) => branch.is_default);
    if (!open || branchTouched || !found || found.project_id !== values.project_id) return;
    untrack(() => {
      values.branch_id = found.id;
      branchLabel = found.name;
    });
  });

  const projectName = $derived(commit?.project.name ?? project.data?.name);
  const hashIsValid = $derived(isCommitHash(values.commit_hash));
  const hashHint = $derived(
    hashIsValid
      ? `Short hash ${shortHash(values.commit_hash)} · ${values.commit_hash.length} characters`
      : 'Paste the full hash, or at least its first 7 characters.',
  );

  function onHashInput(event: Event & { currentTarget: HTMLInputElement }) {
    const normalized = normalizeHashInput(event.currentTarget.value);
    values.commit_hash = normalized;
    // Keep the control in sync even when normalisation produced the same state.
    if (event.currentTarget.value !== normalized) event.currentTarget.value = normalized;
  }

  function changeProject(next: string | null) {
    values.project_id = next ?? '';
    // A different project has different branches and a different default.
    branchTouched = false;
    values.branch_id = '';
    branchLabel = undefined;
  }

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.commits.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.branches.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.releases.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
  }

  const save = createMutation(() => ({
    mutationFn: (data: CommitFormData) => {
      const { project_id, ...fields } = data;
      return commit ? commitsApi.update(commit.id, fields) : commitsApi.create(project_id, fields);
    },
    onSuccess: async (saved: Commit) => {
      invalidate();
      toast.success(isEdit ? 'Commit updated' : `Commit ${saved.short_hash} recorded`);
      onsaved?.(saved);
      if (!isEdit && recordAnother) {
        // Fast entry: keep project, branch and date; clear what is unique per commit.
        branchTouched = true;
        values = {
          ...values,
          commit_hash: '',
          commit_message: '',
          author_name: values.author_name,
          external_url: '',
          description: '',
        };
        errors = {};
        await tick();
        hashInput?.focus();
      } else {
        open = false;
      }
    },
    onError: async (error: unknown) => {
      // 422 details and attributable conflicts (duplicate hash → `commit_hash`)
      // land next to their fields; the typed values are never cleared.
      const fieldErrors = apiFieldErrors(error);
      errors = fieldErrors;
      if (Object.keys(fieldErrors).length === 0) {
        toastError(error, isEdit ? 'Could not save the commit.' : 'Could not record the commit.');
      } else {
        await focusFirstInvalid();
      }
    },
  }));

  async function focusFirstInvalid() {
    await tick();
    form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();
    const result = validateForm(commitFormSchema, values);
    errors = result.errors;
    if (!result.ok) {
      void focusFirstInvalid();
      return;
    }
    save.mutate(result.data);
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
    <Dialog.Header>
      <Dialog.Title>{isEdit ? 'Edit commit' : 'Record commit'}</Dialog.Title>
      <Dialog.Description>
        {isEdit
          ? 'Correct the details of this recorded commit.'
          : 'Paste the hash and message; the rest is optional.'}
      </Dialog.Description>
    </Dialog.Header>

    <form bind:this={form} onsubmit={submit} novalidate class="flex flex-col gap-4">
      {#if projectLocked}
        <div class="flex flex-col gap-1.5">
          <span class="text-foreground text-sm font-medium">Project</span>
          <p class="bg-muted/50 text-foreground flex h-8 items-center rounded-lg border px-2.5 text-sm">
            {projectName ?? 'Loading…'}
          </p>
        </div>
      {:else}
        <FormField label="Project" error={errors.project_id} required>
          {#snippet children(field)}
            <ProjectSelect {...field} value={values.project_id || null} onchange={changeProject} placeholder="Select a project…" />
          {/snippet}
        </FormField>
      {/if}

      <FormField
        label="Commit hash"
        error={errors.commit_hash}
        hint={hashHint}
        required
      >
        {#snippet children(field)}
          <Input
            {...field}
            bind:ref={hashInput}
            value={values.commit_hash}
            oninput={onHashInput}
            class="font-mono"
            maxlength={80}
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            placeholder="e.g. 9fceb02d0ae598e95dc970b74767f19372d61af8"
          />
        {/snippet}
      </FormField>

      <div class="grid gap-4 sm:grid-cols-2">
        <FormField label="Branch" error={errors.branch_id} hint="Pick a branch, or type a new name to add it." required>
          {#snippet children(field)}
            <BranchSelect
              id={field.id}
              aria-invalid={field['aria-invalid']}
              aria-describedby={field['aria-describedby']}
              projectId={values.project_id || null}
              value={values.branch_id || null}
              selectedLabel={branchLabel}
              onchange={(next, branch) => {
                branchTouched = true;
                values.branch_id = next ?? '';
                branchLabel = branch?.name;
              }}
              allowCreate
            />
          {/snippet}
        </FormField>

        <FormField label="Commit date" error={errors.commit_date} required>
          {#snippet children(field)}
            <Input {...field} type="datetime-local" bind:value={values.commit_date} />
          {/snippet}
        </FormField>
      </div>

      <FormField label="Message" error={errors.commit_message} required>
        {#snippet children(field)}
          <Textarea {...field} bind:value={values.commit_message} rows={2} maxlength={2000} placeholder="feat: add checkout flow" />
        {/snippet}
      </FormField>

      <div class="grid gap-4 sm:grid-cols-2">
        <FormField label="Author" error={errors.author_name} optional>
          {#snippet children(field)}
            <Input {...field} bind:value={values.author_name} maxlength={200} autocomplete="off" />
          {/snippet}
        </FormField>

        <FormField
          label="Link"
          error={errors.external_url}
          hint="URL of the commit on your Git host (http or https)."
          optional
        >
          {#snippet children(field)}
            <Input
              {...field}
              type="url"
              inputmode="url"
              bind:value={values.external_url}
              maxlength={2048}
              autocomplete="off"
              placeholder="https://github.com/org/repo/commit/…"
            />
          {/snippet}
        </FormField>
      </div>

      <FormField label="Description" error={errors.description} optional>
        {#snippet children(field)}
          <Textarea
            {...field}
            bind:value={values.description}
            rows={3}
            maxlength={20000}
            placeholder="What this commit changes, why, and anything to remember when deploying it."
          />
        {/snippet}
      </FormField>

      <FormField label="Tags" error={errors.tag_ids} optional>
        {#snippet children(field)}
          <TagPicker
            id={field.id}
            aria-invalid={field['aria-invalid']}
            aria-describedby={field['aria-describedby']}
            bind:values={values.tag_ids}
            selected={commit?.tags}
          />
        {/snippet}
      </FormField>

      <Dialog.Footer class="sm:items-center">
        {#if !isEdit}
          <label class="text-muted-foreground mr-auto flex items-center gap-2 text-sm">
            <Checkbox bind:checked={recordAnother} />
            Record another
          </label>
        {/if}
        <Button type="button" variant="outline" onclick={() => (open = false)}>Cancel</Button>
        <Button type="submit" disabled={save.isPending}>
          {#if save.isPending}
            Saving…
          {:else}
            {isEdit ? 'Save changes' : 'Record commit'}
          {/if}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
