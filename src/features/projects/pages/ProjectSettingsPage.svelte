<!-- Project settings: details form, environments link, archive / restore, delete. -->
<script lang="ts">
  import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import { apiFieldErrors, isApiError, queryKeys, type FieldErrors } from '$lib/api';
  import { confirm, DateTime, DetailSkeleton, ErrorState, PageHeader, toast, toastError } from '$lib/components';
  import { Button } from '$lib/components/ui/button';
  import { navigate, setPageTitle } from '$lib/router';
  import { pluralize } from '$lib/utils';
  import { validateForm } from '$lib/validators';
  import { paths } from '$routes/paths';
  import { projectsApi } from '../api';
  import ProjectTabs from '../components/ProjectTabs.svelte';
  import DeleteProjectDialog from '../components/DeleteProjectDialog.svelte';
  import ProjectFields from '../components/ProjectFields.svelte';
  import { projectFormValues, type ProjectFormValues } from '../form';
  import { invalidateAllProjectData } from '../queries';
  import type { Project, ProjectStatus } from '../types';
  import { projectUpdateSchema, type ProjectUpdateData } from '../validation';

  let { projectId }: { projectId: string } = $props();

  const queryClient = useQueryClient();

  const project = createQuery(() => ({
    queryKey: queryKeys.projects.detail(projectId),
    queryFn: ({ signal }) => projectsApi.get(projectId, signal),
  }));

  let values = $state<ProjectFormValues>(projectFormValues());
  let errors = $state<FieldErrors>({});
  /** `updated_at` of the record the form was last filled from. */
  let loadedVersion: string | null = null;
  let deleteOpen = $state(false);

  // Fill the form when the project first arrives and after each successful
  // save — never on a background refetch, which would discard unsaved edits.
  $effect(() => {
    const current = project.data;
    if (current && loadedVersion === null) {
      values = projectFormValues(current);
      loadedVersion = current.updated_at;
    }
  });

  $effect(() => {
    if (project.data) setPageTitle(`Settings · ${project.data.name}`);
  });

  const dirty = $derived(
    project.data ? JSON.stringify(values) !== JSON.stringify(projectFormValues(project.data)) : false,
  );

  function applySaved(saved: Project) {
    queryClient.setQueryData(queryKeys.projects.detail(projectId), saved);
    values = projectFormValues(saved);
    loadedVersion = saved.updated_at;
    errors = {};
    // The project's name, slug and tags are embedded in every other resource.
    invalidateAllProjectData(queryClient);
  }

  const save = createMutation(() => ({
    mutationFn: (data: ProjectUpdateData) => projectsApi.update(projectId, data),
    onSuccess: (saved) => {
      applySaved(saved);
      toast.success('Project saved');
    },
    onError: (error) => {
      errors = apiFieldErrors(error);
      toastError(error, 'Could not save the project.');
    },
  }));

  const setStatus = createMutation(() => ({
    mutationFn: (status: ProjectStatus) => projectsApi.update(projectId, { status }),
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.projects.detail(projectId), saved);
      invalidateAllProjectData(queryClient);
      toast.success(saved.status === 'archived' ? 'Project archived' : 'Project restored');
    },
    onError: (error) => toastError(error, 'Could not update the project.'),
  }));

  function submit(event: SubmitEvent) {
    event.preventDefault();
    const result = validateForm(projectUpdateSchema, values);
    errors = result.errors;
    if (result.ok) save.mutate(result.data);
  }

  async function archive(current: Project) {
    const ok = await confirm({
      title: `Archive “${current.name}”?`,
      description:
        'Archived projects are hidden from the dashboard and from pickers. Nothing is deleted and you can restore the project at any time.',
      confirmLabel: 'Archive',
    });
    if (ok) setStatus.mutate('archived');
  }
</script>

<div class="page">
  {#if project.isPending}
    <DetailSkeleton />
  {:else if project.isError}
    <PageHeader
      title="Project settings"
      breadcrumbs={[{ label: 'Projects', href: paths.projects() }, { label: 'Settings' }]}
    />
    <ErrorState
      error={project.error}
      title={isApiError(project.error) && project.error.isNotFound ? 'Project not found' : undefined}
      onretry={() => project.refetch()}
      retrying={project.isFetching}
    />
  {:else}
    {@const current = project.data}
    <PageHeader
      title="Project settings"
      breadcrumbs={[
        { label: 'Projects', href: paths.projects() },
        { label: current.name, href: paths.project(projectId) },
        { label: 'Settings' },
      ]}
    />

    <ProjectTabs {projectId} />

    <div class="flex max-w-3xl flex-col gap-6">
      <section aria-labelledby="project-details-heading" class="bg-card rounded-lg border">
        <div class="border-b px-4 py-3">
          <h2 id="project-details-heading" class="text-sm font-semibold">Details</h2>
        </div>
        <form onsubmit={submit} novalidate class="flex flex-col gap-4 p-4">
          <ProjectFields
            bind:values
            {errors}
            mode="edit"
            selectedTags={current.tags}
            originalSlug={current.slug}
            disabled={save.isPending}
          />
          <div class="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
            {#if dirty}
              <span class="text-muted-foreground mr-auto text-xs" role="status">Unsaved changes</span>
              <Button
                type="button"
                variant="ghost"
                onclick={() => {
                  values = projectFormValues(current);
                  errors = {};
                }}
                disabled={save.isPending}
              >
                Discard
              </Button>
            {/if}
            <Button type="submit" disabled={save.isPending || !dirty}>
              {save.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </section>

      <section aria-labelledby="project-environments-heading" class="bg-card rounded-lg border">
        <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div class="space-y-0.5">
            <h2 id="project-environments-heading" class="text-sm font-semibold">Environments</h2>
            <p class="text-muted-foreground text-sm">
              {current.stats.environment_count === 0
                ? 'No environments yet. Add the places this project is deployed to.'
                : `${pluralize(current.stats.environment_count, 'environment')} — rename, recolour, reorder or remove them.`}
            </p>
          </div>
          <Button variant="outline" href={paths.projectEnvironments(projectId)}>
            Manage environments
            <ChevronRightIcon aria-hidden="true" />
          </Button>
        </div>
      </section>

      <section aria-labelledby="project-archive-heading" class="bg-card rounded-lg border">
        <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div class="max-w-xl space-y-0.5">
            <h2 id="project-archive-heading" class="text-sm font-semibold">
              {current.status === 'archived' ? 'Restore project' : 'Archive project'}
            </h2>
            <p class="text-muted-foreground text-sm">
              {#if current.status === 'archived'}
                Archived <DateTime value={current.archived_at} />. Restoring shows the project on the dashboard and
                in pickers again.
              {:else}
                Hide the project from the dashboard and from pickers without deleting anything. You can restore it
                later.
              {/if}
            </p>
          </div>
          {#if current.status === 'archived'}
            <Button variant="outline" onclick={() => setStatus.mutate('active')} disabled={setStatus.isPending}>
              Restore project
            </Button>
          {:else}
            <Button variant="outline" onclick={() => archive(current)} disabled={setStatus.isPending}>
              Archive project
            </Button>
          {/if}
        </div>
      </section>

      <section aria-labelledby="project-danger-heading" class="border-danger/25 rounded-lg border">
        <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div class="max-w-xl space-y-0.5">
            <h2 id="project-danger-heading" class="text-danger text-sm font-semibold">Delete project</h2>
            <p class="text-muted-foreground text-sm">
              Permanently removes the project and everything recorded in it: environments, commits, deployment
              records, releases and project notes. Tags and global notes are kept.
            </p>
          </div>
          <Button variant="destructive" onclick={() => (deleteOpen = true)}>Delete project…</Button>
        </div>
      </section>
    </div>

    <DeleteProjectDialog
      bind:open={deleteOpen}
      project={current}
      ondeleted={() => navigate(paths.projects(), { replace: true })}
    />
  {/if}
</div>
