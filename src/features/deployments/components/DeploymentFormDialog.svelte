<!--
  Record (no `deployment`) or edit a deployment record in a dialog.
  `projectId`, `environmentId` and `commitId` pre-select and — when given —
  lock the corresponding choice (e.g. "Record deployment" on a commit page).

  A deployment record documents that a deployment happened. Saving it changes
  nothing outside CommitVault and never runs anything.
-->
<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
  import { apiFieldErrors, queryKeys, type FieldErrors } from '$lib/api';
  import { EnvironmentBadge, FormField, STATUS_PRESENTATION, toast, toastError } from '$lib/components';
  import { Button } from '$lib/components/ui/button';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import * as Select from '$lib/components/ui/select';
  import { Textarea } from '$lib/components/ui/textarea';
  import { DEPLOYMENT_STATUSES } from '$lib/types';
  import { toDateTimeInputValue } from '$lib/utils/format';
  import { validateForm } from '$lib/validators';
  import { commitsApi } from '$features/commits/api';
  import CommitPicker from '$features/commits/components/CommitPicker.svelte';
  import { commitSubject } from '$features/commits/format';
  import { environmentsApi } from '$features/environments/api';
  import EnvironmentSelect from '$features/environments/components/EnvironmentSelect.svelte';
  import { projectsApi } from '$features/projects/api';
  import ProjectSelect from '$features/projects/components/ProjectSelect.svelte';
  import TagPicker from '$features/tags/components/TagPicker.svelte';
  import { deploymentsApi } from '../api';
  import type { Deployment, DeploymentStatus } from '../types';
  import { defaultDeploymentTitle, deploymentFormSchema, type DeploymentFormData } from '../validation';

  interface Props {
    open?: boolean;
    projectId?: string;
    environmentId?: string;
    commitId?: string;
    deployment?: Deployment;
    onsaved?: (deployment: Deployment) => void;
  }

  let { open = $bindable(false), projectId, environmentId, commitId, deployment, onsaved }: Props = $props();

  const queryClient = useQueryClient();

  const isEdit = $derived(deployment !== undefined);
  const projectLocked = $derived(isEdit || projectId !== undefined);
  const environmentLocked = $derived(environmentId !== undefined);
  const commitLocked = $derived(commitId !== undefined);

  function initialValues() {
    return {
      project_id: deployment?.project_id ?? projectId ?? '',
      environment_id: deployment?.environment.id ?? environmentId ?? '',
      commit_id: deployment?.commit.id ?? commitId ?? '',
      deployment_title: deployment?.deployment_title ?? '',
      status: (deployment?.status ?? 'successful') as DeploymentStatus,
      deployed_at: toDateTimeInputValue(deployment?.deployed_at ?? new Date()),
      deployment_notes: deployment?.deployment_notes ?? '',
      tag_ids: deployment?.tags.map((tag) => tag.id) ?? [],
    };
  }

  let values = $state(initialValues());
  let errors = $state<FieldErrors>({});
  /** Until the user edits the title it follows the chosen commit and environment. */
  let titleTouched = $state(false);
  let form = $state<HTMLFormElement | null>(null);

  let wasOpen = false;
  $effect(() => {
    const isOpen = open;
    if (isOpen && !wasOpen) {
      untrack(() => {
        values = initialValues();
        errors = {};
        titleTouched = isEdit;
      });
    }
    wasOpen = isOpen;
  });

  const project = createQuery(() => ({
    queryKey: queryKeys.projects.detail(values.project_id),
    queryFn: ({ signal }) => projectsApi.get(values.project_id, signal),
    enabled: open && projectLocked && values.project_id !== '',
    staleTime: 60_000,
  }));

  const environments = createQuery(() => ({
    queryKey: queryKeys.environments.byProject(values.project_id),
    queryFn: ({ signal }) => environmentsApi.listForProject(values.project_id, signal),
    enabled: open && values.project_id !== '',
  }));

  const commit = createQuery(() => ({
    queryKey: queryKeys.commits.detail(values.commit_id),
    queryFn: ({ signal }) => commitsApi.get(values.commit_id, signal),
    enabled: open && values.commit_id !== '',
    staleTime: 60_000,
  }));

  const projectName = $derived(deployment?.project.name ?? project.data?.name);
  const environment = $derived(
    environments.data?.find((candidate) => candidate.id === values.environment_id) ??
      (deployment && deployment.environment.id === values.environment_id ? deployment.environment : undefined),
  );
  const chosenCommit = $derived(
    commit.data && commit.data.id === values.commit_id
      ? commit.data
      : deployment && deployment.commit.id === values.commit_id
        ? deployment.commit
        : undefined,
  );

  // Suggest a title as soon as both ends of the deployment are known.
  $effect(() => {
    if (!open || titleTouched || !environment || !chosenCommit) return;
    const suggestion = defaultDeploymentTitle(chosenCommit.short_hash, environment.name);
    untrack(() => (values.deployment_title = suggestion));
  });

  function changeProject(next: string | null) {
    values.project_id = next ?? '';
    // Environments and commits belong to one project.
    if (!environmentLocked) values.environment_id = '';
    if (!commitLocked) values.commit_id = '';
    if (!titleTouched) values.deployment_title = '';
  }

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.deployments.all });
    // Latest-deployment summaries and per-commit record counts are derived data.
    void queryClient.invalidateQueries({ queryKey: queryKeys.environments.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.commits.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
  }

  const save = createMutation(() => ({
    mutationFn: (data: DeploymentFormData) => {
      const { project_id, ...fields } = data;
      return deployment ? deploymentsApi.update(deployment.id, fields) : deploymentsApi.create(project_id, fields);
    },
    onSuccess: (saved: Deployment) => {
      invalidate();
      toast.success(isEdit ? 'Deployment record updated' : `Deployment to ${saved.environment.name} recorded`);
      onsaved?.(saved);
      open = false;
    },
    onError: async (error: unknown) => {
      const fieldErrors = apiFieldErrors(error);
      errors = fieldErrors;
      if (Object.keys(fieldErrors).length === 0) {
        toastError(error, isEdit ? 'Could not save the deployment record.' : 'Could not record the deployment.');
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
    const result = validateForm(deploymentFormSchema, values);
    errors = result.errors;
    if (!result.ok) {
      void focusFirstInvalid();
      return;
    }
    save.mutate(result.data);
  }
</script>

{#snippet locked(label: string)}
  <span class="text-foreground text-sm font-medium">{label}</span>
{/snippet}

<!-- A locked choice has no control to attach a server error to, so show it as text. -->
{#snippet lockedError(message: string | undefined)}
  {#if message}
    <p class="text-danger text-xs" role="alert">{message}</p>
  {/if}
{/snippet}

<Dialog.Root bind:open>
  <Dialog.Content class="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
    <Dialog.Header>
      <Dialog.Title>{isEdit ? 'Edit deployment' : 'Record deployment'}</Dialog.Title>
      <Dialog.Description>
        {isEdit
          ? 'Correct the details of this deployment.'
          : 'Which commit went to which environment, and when. CommitVault only keeps the record.'}
      </Dialog.Description>
    </Dialog.Header>

    <form bind:this={form} onsubmit={submit} novalidate class="flex flex-col gap-4">
      {#if projectLocked}
        <div class="flex flex-col gap-1.5">
          {@render locked('Project')}
          <p class="bg-muted/50 text-foreground flex h-8 items-center rounded-lg border px-2.5 text-sm">
            {projectName ?? 'Loading…'}
          </p>
          {@render lockedError(errors.project_id)}
        </div>
      {:else}
        <FormField label="Project" error={errors.project_id} required>
          {#snippet children(field)}
            <ProjectSelect {...field} value={values.project_id || null} onchange={changeProject} placeholder="Select a project…" />
          {/snippet}
        </FormField>
      {/if}

      {#if commitLocked}
        <div class="flex flex-col gap-1.5">
          {@render locked('Commit')}
          <p class="bg-muted/50 flex h-8 min-w-0 items-center gap-2 rounded-lg border px-2.5 text-sm">
            {#if chosenCommit}
              <code class="text-foreground shrink-0 font-mono text-xs">{chosenCommit.short_hash}</code>
              <span class="text-muted-foreground truncate">{commitSubject(chosenCommit.commit_message)}</span>
            {:else}
              <span class="text-muted-foreground">Loading…</span>
            {/if}
          </p>
          {@render lockedError(errors.commit_id)}
        </div>
      {:else}
        <FormField label="Commit" error={errors.commit_id} required>
          {#snippet children(field)}
            <CommitPicker
              {...field}
              projectId={values.project_id || null}
              value={values.commit_id || null}
              selected={chosenCommit ?? null}
              onchange={(next) => (values.commit_id = next ?? '')}
            />
          {/snippet}
        </FormField>
      {/if}

      <div class="grid gap-4 sm:grid-cols-2">
        {#if environmentLocked}
          <div class="flex flex-col gap-1.5">
            {@render locked('Environment')}
            <p class="bg-muted/50 flex h-8 items-center rounded-lg border px-2.5 text-sm">
              {#if environment}
                <EnvironmentBadge name={environment.name} color={environment.color} size="sm" />
              {:else}
                <span class="text-muted-foreground">Loading…</span>
              {/if}
            </p>
            {@render lockedError(errors.environment_id)}
          </div>
        {:else}
          <FormField
            label="Environment"
            error={errors.environment_id}
            hint={values.project_id !== '' && environments.data?.length === 0
              ? 'This project has no environments yet. Add one in the project’s environment settings.'
              : undefined}
            required
          >
            {#snippet children(field)}
              <EnvironmentSelect
                {...field}
                projectId={values.project_id || null}
                value={values.environment_id || null}
                onchange={(next) => (values.environment_id = next ?? '')}
                placeholder="Select an environment…"
              />
            {/snippet}
          </FormField>
        {/if}

        <FormField label="Status" error={errors.status} required>
          {#snippet children(field)}
            <Select.Root
              type="single"
              value={values.status}
              onValueChange={(next) => (values.status = next as DeploymentStatus)}
            >
              <Select.Trigger {...field} class="w-full">
                {STATUS_PRESENTATION[values.status].label}
              </Select.Trigger>
              <Select.Content>
                {#each DEPLOYMENT_STATUSES as status (status)}
                  <Select.Item value={status} label={STATUS_PRESENTATION[status].label} />
                {/each}
              </Select.Content>
            </Select.Root>
          {/snippet}
        </FormField>
      </div>


      <FormField label="Title" error={errors.deployment_title} required>
        {#snippet children(field)}
          <Input
            {...field}
            bind:value={values.deployment_title}
            oninput={() => (titleTouched = true)}
            maxlength={200}
            autocomplete="off"
            placeholder="Deploy a1b2c3d to Production"
          />
        {/snippet}
      </FormField>

      <FormField label="Deployed at" error={errors.deployed_at} required>
        {#snippet children(field)}
          <Input {...field} type="datetime-local" bind:value={values.deployed_at} class="sm:max-w-64" />
        {/snippet}
      </FormField>

      <FormField
        label="Notes"
        error={errors.deployment_notes}
        hint="Stored as documentation. CommitVault never runs commands."
        optional
      >
        {#snippet children(field)}
          <Textarea
            {...field}
            bind:value={values.deployment_notes}
            rows={5}
            maxlength={20000}
            spellcheck="false"
            class="font-mono text-xs md:text-xs"
            placeholder={'What changed, commands you ran, migration steps…\n\nsqlx migrate run\nsystemctl restart app'}
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
            selected={deployment?.tags}
          />
        {/snippet}
      </FormField>

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => (open = false)}>Cancel</Button>
        <Button type="submit" disabled={save.isPending}>
          {#if save.isPending}
            Saving…
          {:else}
            {isEdit ? 'Save changes' : 'Record deployment'}
          {/if}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
