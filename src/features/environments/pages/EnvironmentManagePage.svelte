<!--
  Environment management for one project: create, edit, reorder and delete.
  Environment names are entirely user-defined.
-->
<script lang="ts">
  import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
  import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
  import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import ServerIcon from '@lucide/svelte/icons/server';
  import TrashIcon from '@lucide/svelte/icons/trash';
  import { isApiError, queryKeys, removeFromCache } from '$lib/api';
  import {
    confirm,
    EmptyState,
    EnvironmentBadge,
    ErrorState,
    ListSkeleton,
    PageHeader,
    toast,
    toastError,
  } from '$lib/components';
  import { Button } from '$lib/components/ui/button';
  import { setPageTitle } from '$lib/router';
  import { pluralize } from '$lib/utils';
  import { paths } from '$routes/paths';
  import { projectsApi } from '$features/projects/api';
  import { environmentsApi } from '../api';
  import EnvironmentFormDialog from '../components/EnvironmentFormDialog.svelte';
  import LatestDeployment from '../components/LatestDeployment.svelte';
  import { invalidateEnvironments } from '../queries';
  import type { Environment } from '../types';
  import { MAX_ENVIRONMENTS_PER_PROJECT } from '../validation';

  let { projectId }: { projectId: string } = $props();

  /** Starting points offered only while the project has no environments. */
  const SUGGESTIONS = [
    { name: 'Development', color: '#3b82f6' },
    { name: 'Staging', color: '#eab308' },
    { name: 'Production', color: '#22c55e' },
  ] as const;

  const queryClient = useQueryClient();
  const listKey = $derived(queryKeys.environments.byProject(projectId));

  const project = createQuery(() => ({
    queryKey: queryKeys.projects.detail(projectId),
    queryFn: ({ signal }) => projectsApi.get(projectId, signal),
  }));

  const environments = createQuery(() => ({
    queryKey: listKey,
    queryFn: ({ signal }) => environmentsApi.listForProject(projectId, signal),
    enabled: project.isSuccess,
  }));

  $effect(() => {
    if (project.data) setPageTitle(`Environments · ${project.data.name}`);
  });

  const atLimit = $derived((environments.data?.length ?? 0) >= MAX_ENVIRONMENTS_PER_PROJECT);

  let dialogOpen = $state(false);
  let editing = $state.raw<Environment | undefined>(undefined);
  let suggestion = $state.raw<{ name: string; color: string } | undefined>(undefined);
  /** Announced to screen readers after a move. */
  let announcement = $state('');

  function openCreate(suggested?: { name: string; color: string }) {
    editing = undefined;
    suggestion = suggested;
    dialogOpen = true;
  }

  function openEdit(environment: Environment) {
    editing = environment;
    suggestion = undefined;
    dialogOpen = true;
  }

  const reorder = createMutation(() => ({
    // Moves are applied one after another, in the order they were made.
    scope: { id: `environment-order-${projectId}` },
    mutationFn: (orderedIds: string[]) => environmentsApi.reorder(projectId, orderedIds),
    onMutate: async (orderedIds: string[]) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<Environment[]>(listKey);
      if (previous) {
        const byId = new Map(previous.map((environment) => [environment.id, environment]));
        const next = orderedIds
          .map((id, position) => {
            const environment = byId.get(id);
            return environment ? { ...environment, position } : undefined;
          })
          .filter((environment): environment is Environment => environment !== undefined);
        queryClient.setQueryData(listKey, next);
      }
      return { previous };
    },
    onError: (error, _orderedIds, context) => {
      // Put the list back the way the server still has it.
      if (context?.previous) queryClient.setQueryData(listKey, context.previous);
      announcement = 'The new order could not be saved.';
      toastError(error, 'Could not save the new order.');
    },
    onSuccess: (saved) => {
      // Skip when another move is already queued; its optimistic order is newer.
      if (queryClient.isMutating({ mutationKey: ['environment-order', projectId] }) <= 1) {
        queryClient.setQueryData(listKey, saved);
      }
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: ['environment-order', projectId] }) <= 1) {
        invalidateEnvironments(queryClient);
      }
    },
    mutationKey: ['environment-order', projectId],
  }));

  function move(index: number, offset: -1 | 1) {
    const list = queryClient.getQueryData<Environment[]>(listKey) ?? environments.data ?? [];
    const target = index + offset;
    const moved = list[index];
    if (!moved || target < 0 || target >= list.length) return;

    const ids = list.map((environment) => environment.id);
    ids.splice(index, 1);
    ids.splice(target, 0, moved.id);
    announcement = `${moved.name} moved to position ${target + 1} of ${list.length}.`;
    reorder.mutate(ids);
  }

  const remove = createMutation(() => ({
    mutationFn: (input: { environment: Environment; cascade: boolean }) =>
      environmentsApi.remove(input.environment.id, { cascade: input.cascade }),
    // Optimistic: the row disappears at once; restored if the server refuses.
    onMutate: (input) => {
      const restore = removeFromCache(queryClient, input.environment.id, [queryKeys.environments.all]);
      toast.success(
        input.cascade
          ? `Environment “${input.environment.name}” and ${pluralize(input.environment.deployment_count, 'deployment record')} deleted`
          : `Environment “${input.environment.name}” deleted`,
      );
      return { restore };
    },
    onError: (error, _input, context) => {
      context?.restore();
      // A 409 means records were added since this list was loaded.
      if (isApiError(error) && error.isConflict) void environments.refetch();
      toastError(error, 'Could not delete the environment. It is back in the list.');
    },
    onSettled: () => invalidateEnvironments(queryClient),
  }));

  async function destroy(environment: Environment) {
    const records = environment.deployment_count;
    const ok = await confirm(
      records === 0
        ? {
            title: `Delete environment “${environment.name}”?`,
            description: 'No deployments are recorded for it. This cannot be undone.',
            confirmLabel: 'Delete environment',
            destructive: true,
          }
        : {
            title: `Delete environment “${environment.name}”?`,
            description: `${pluralize(records, 'deployment record')} ${records === 1 ? 'belongs' : 'belong'} to this environment. Deleting it will also delete ${records === 1 ? 'that record' : `those ${records} records`} from the deployment history. Commits are kept. This cannot be undone.`,
            confirmLabel: `Also delete ${pluralize(records, 'deployment record')}`,
            destructive: true,
          },
    );
    if (ok) remove.mutate({ environment, cascade: records > 0 });
  }
</script>

<div class="page">
  {#if project.isPending}
    <PageHeader title="Environments" />
    <ListSkeleton rows={4} />
  {:else if project.isError}
    <PageHeader
      title="Environments"
      breadcrumbs={[{ label: 'Projects', href: paths.projects() }, { label: 'Environments' }]}
    />
    <ErrorState
      error={project.error}
      title={isApiError(project.error) && project.error.isNotFound ? 'Project not found' : undefined}
      onretry={() => project.refetch()}
      retrying={project.isFetching}
    />
  {:else}
    <PageHeader
      title="Environments"
      description="The order here is the order used everywhere else."
      breadcrumbs={[
        { label: 'Projects', href: paths.projects() },
        { label: project.data.name, href: paths.project(projectId) },
        { label: 'Environments' },
      ]}
    >
      {#snippet actions()}
        <Button variant="outline" href={paths.projectCompare(projectId)}>Compare environments</Button>
        <Button
          onclick={() => openCreate()}
          disabled={atLimit}
          title={atLimit ? `A project can have at most ${MAX_ENVIRONMENTS_PER_PROJECT} environments.` : undefined}
        >
          <PlusIcon aria-hidden="true" />
          New environment
        </Button>
      {/snippet}
    </PageHeader>

    <p class="sr-only" role="status" aria-live="polite">{announcement}</p>

    {#if environments.isPending}
      <ListSkeleton rows={4} />
    {:else if environments.isError}
      <ErrorState error={environments.error} onretry={() => environments.refetch()} retrying={environments.isFetching} />
    {:else if environments.data.length === 0}
      <EmptyState
        icon={ServerIcon}
        title="No environments yet"
        description="An environment is anywhere this project runs — a laptop, a staging server, production. Add one to start recording deployments against it."
      >
        {#snippet action()}
          <Button onclick={() => openCreate()}>
            <PlusIcon aria-hidden="true" />
            New environment
          </Button>
          <span class="text-muted-foreground text-xs">or start from</span>
          {#each SUGGESTIONS as suggested (suggested.name)}
            <Button variant="outline" size="sm" onclick={() => openCreate(suggested)}>{suggested.name}</Button>
          {/each}
        {/snippet}
      </EmptyState>
    {:else}
      {@const list = environments.data}
      <ol class="bg-card divide-y rounded-lg border" aria-label="Environments in display order">
        {#each list as environment, index (environment.id)}
          <li class="flex flex-wrap items-start gap-x-4 gap-y-3 px-4 py-3">
            <div class="flex shrink-0 items-center gap-1">
              <span class="text-muted-foreground tabular w-5 text-right text-xs" aria-hidden="true">{index + 1}</span>
              <div class="flex flex-col">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Move ${environment.name} up`}
                  disabled={index === 0}
                  onclick={() => move(index, -1)}
                >
                  <ArrowUpIcon aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Move ${environment.name} down`}
                  disabled={index === list.length - 1}
                  onclick={() => move(index, 1)}
                >
                  <ArrowDownIcon aria-hidden="true" />
                </Button>
              </div>
            </div>

            <div class="flex min-w-48 flex-1 flex-col gap-1">
              <div class="flex flex-wrap items-center gap-2">
                <EnvironmentBadge name={environment.name} color={environment.color} size="md" />
                {#if environment.server_label}
                  <span class="text-muted-foreground font-mono text-xs">{environment.server_label}</span>
                {/if}
              </div>
              {#if environment.description}
                <p class="text-muted-foreground max-w-prose text-sm whitespace-pre-line">{environment.description}</p>
              {/if}
            </div>

            <div class="flex min-w-56 flex-[1.5] flex-col gap-1">
              <span class="eyebrow">Latest recorded deployment</span>
              <LatestDeployment deployment={environment.latest_deployment} showMessage />
              <a
                href={paths.deployments({ project_id: projectId, environment_id: environment.id })}
                class="text-muted-foreground hover:text-foreground tabular w-fit text-xs"
              >
                {pluralize(environment.deployment_count, 'deployment record')}
              </a>
            </div>

            <div class="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="icon-sm" aria-label={`Edit ${environment.name}`} onclick={() => openEdit(environment)}>
                <PencilIcon aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${environment.name}`}
                disabled={remove.isPending}
                onclick={() => destroy(environment)}
              >
                <TrashIcon aria-hidden="true" />
              </Button>
            </div>
          </li>
        {/each}
      </ol>
      {#if atLimit}
        <p class="text-muted-foreground mt-3 text-xs">
          This project has the maximum of {MAX_ENVIRONMENTS_PER_PROJECT} environments.
        </p>
      {/if}
    {/if}

    <EnvironmentFormDialog
      bind:open={dialogOpen}
      {projectId}
      environment={editing}
      suggestedName={suggestion?.name}
      suggestedColor={suggestion?.color}
    />
  {/if}
</div>
