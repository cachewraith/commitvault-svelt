<!--
  One deployment record: what was deployed where and when, as the user noted it.
  Notes are shown as plain text with a copy button — they are documentation and
  are never interpreted or executed. Rendered as a full page (`layout="page"`)
  or inside the deployment history's slide-in panel (`layout="panel"`).
-->
<script lang="ts">
  import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import TrashIcon from '@lucide/svelte/icons/trash';
  import { isApiError, queryKeys } from '$lib/api';
  import {
    BranchBadge,
    CopyButton,
    DateTime,
    DetailSkeleton,
    EnvironmentBadge,
    ErrorState,
    HashChip,
    PageHeader,
    StatusBadge,
    TagBadge,
    confirm,
    toast,
    toastError,
  } from '$lib/components';
  import { Button } from '$lib/components/ui/button';
  import { navigate, setPageTitle } from '$lib/router';
  import { cn } from '$lib/utils/cn';
  import { commitSubject } from '$features/commits/format';
  import { paths } from '$routes/paths';
  import { deploymentsApi } from '../api';
  import DeploymentFormDialog from './DeploymentFormDialog.svelte';

  interface Props {
    deploymentId: string;
    layout?: 'page' | 'panel';
    /** After a successful delete. Default: go to the deployment history. */
    ondeleted?: () => void;
  }

  let { deploymentId, layout = 'page', ondeleted }: Props = $props();
  const isPage = $derived(layout === 'page');

  const queryClient = useQueryClient();

  const deployment = createQuery(() => ({
    queryKey: queryKeys.deployments.detail(deploymentId),
    queryFn: ({ signal }) => deploymentsApi.get(deploymentId, signal),
  }));

  const notFound = $derived(isApiError(deployment.error) && deployment.error.isNotFound);

  $effect(() => {
    if (isPage && deployment.data) setPageTitle(deployment.data.deployment_title);
  });

  let editOpen = $state(false);

  const removeDeployment = createMutation(() => ({
    mutationFn: () => deploymentsApi.remove(deploymentId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.deployments.detail(deploymentId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.deployments.lists() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.environments.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.commits.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      toast.success('Deployment record deleted');
      if (ondeleted) ondeleted();
      else navigate(paths.deployments(), { replace: true });
    },
    onError: (error) => toastError(error, 'Could not delete the deployment record.'),
  }));

  async function remove() {
    const ok = await confirm({
      title: 'Delete this deployment record?',
      description:
        'Only the record is removed from your history. The commit and the environment stay, and nothing changes on any server.',
      confirmLabel: 'Delete record',
      destructive: true,
    });
    if (ok) removeDeployment.mutate();
  }
</script>

{#snippet actionButtons(compact: boolean)}
  <Button size={compact ? 'sm' : 'default'} variant="outline" onclick={() => (editOpen = true)}>
    <PencilIcon aria-hidden="true" />
    Edit
  </Button>
  <Button size={compact ? 'sm' : 'default'} variant="outline" onclick={remove} disabled={removeDeployment.isPending}>
    <TrashIcon aria-hidden="true" />
    Delete
  </Button>
{/snippet}

<div>
  {#if deployment.isPending}
    <DetailSkeleton />
  {:else if deployment.isError}
    {#if isPage}
      <PageHeader
        title="Deployment record"
        breadcrumbs={[{ label: 'Deployments', href: paths.deployments() }, { label: 'Record' }]}
      />
    {/if}
    <ErrorState
      error={deployment.error}
      title={notFound ? 'Deployment record not found' : 'This deployment record could not be loaded'}
      message={notFound ? 'It may have been deleted, or the link is wrong.' : undefined}
      onretry={notFound ? undefined : () => deployment.refetch()}
      retrying={deployment.isFetching}
    />
    {#if isPage}
      <div class="mt-4">
        <Button variant="outline" href={paths.deployments()}>Back to deployment history</Button>
      </div>
    {/if}
  {:else}
    {@const data = deployment.data}

    {#if isPage}
      <PageHeader
        title={data.deployment_title}
        breadcrumbs={[
          { label: 'Deployments', href: paths.deployments() },
          { label: data.project.name, href: paths.deployments({ project_id: data.project_id }) },
          { label: data.environment.name },
        ]}
      >
        {#snippet meta()}
          <StatusBadge status={data.status} />
        {/snippet}
        {#snippet actions()}
          {@render actionButtons(false)}
        {/snippet}
      </PageHeader>
    {:else}
      <header class="mb-5 flex flex-col gap-3">
        <div class="flex min-w-0 flex-col gap-1.5">
          <p class="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
            <a href={paths.project(data.project.id)} class="hover:text-foreground">{data.project.name}</a>
            <span aria-hidden="true">·</span>
            <EnvironmentBadge name={data.environment.name} color={data.environment.color} />
          </p>
          <h2 class="text-foreground text-lg font-semibold break-words">{data.deployment_title}</h2>
          <div><StatusBadge status={data.status} /></div>
        </div>
        <div class="flex flex-wrap gap-2">{@render actionButtons(true)}</div>
      </header>
    {/if}

    <div class={cn('grid gap-6', isPage && 'lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]')}>
      <div class="flex min-w-0 flex-col gap-6">
        <section aria-labelledby="deployment-commit-heading" class="bg-card rounded-lg border p-4">
          <h2 id="deployment-commit-heading" class="eyebrow mb-2">Commit</h2>
          <a
            href={paths.commit(data.commit.id)}
            class="text-foreground hover:text-brand block text-sm font-medium break-words"
          >
            {commitSubject(data.commit.commit_message)}
          </a>
          <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <HashChip hash={data.commit.commit_hash} short={data.commit.short_hash} href={paths.commit(data.commit.id)} />
            <BranchBadge name={data.commit.branch_name} />
            <span class="text-muted-foreground text-xs">
              Committed <DateTime value={data.commit.commit_date} mode="date" />
            </span>
          </div>
        </section>

        <section aria-labelledby="deployment-notes-heading">
          <div class="mb-2 flex items-center justify-between gap-2">
            <h2 id="deployment-notes-heading" class="text-sm font-semibold">Notes</h2>
            {#if data.deployment_notes}
              <CopyButton value={data.deployment_notes} label="Copy notes" text="Copy notes" variant="outline" size="sm" />
            {/if}
          </div>
          {#if data.deployment_notes}
            <!-- Plain text on purpose: commands are shown for reading and copying, never run or linked. -->
            <pre
              class="bg-card text-foreground max-h-[32rem] overflow-auto rounded-lg border p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">{data.deployment_notes}</pre>
            <p class="text-muted-foreground mt-2 text-xs">
              Stored as documentation. CommitVault never runs commands.
            </p>
          {:else}
            <p class="text-muted-foreground text-sm">
              No notes. Edit the record to add what changed, commands you ran or migration steps.
            </p>
          {/if}
        </section>
      </div>

      <aside class="min-w-0" aria-label="Deployment record details">
        <section class="bg-card rounded-lg border p-4">
          <h2 class="mb-3 text-sm font-semibold">Details</h2>
          <dl class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm">
            <dt class="text-muted-foreground">Status</dt>
            <dd><StatusBadge status={data.status} variant="dot" /></dd>

            <dt class="text-muted-foreground">Environment</dt>
            <dd>
              <EnvironmentBadge
                name={data.environment.name}
                color={data.environment.color}
                href={paths.deployments({ project_id: data.project_id, environment_id: data.environment.id })}
              />
            </dd>

            <dt class="text-muted-foreground">Project</dt>
            <dd><a href={paths.project(data.project.id)} class="text-brand hover:underline">{data.project.name}</a></dd>

            <dt class="text-muted-foreground">Deployed</dt>
            <dd><DateTime value={data.deployed_at} mode="both" /></dd>

            <dt class="text-muted-foreground">Recorded</dt>
            <dd><DateTime value={data.created_at} mode="datetime" /></dd>

            {#if data.updated_at !== data.created_at}
              <dt class="text-muted-foreground">Updated</dt>
              <dd><DateTime value={data.updated_at} mode="relative" /></dd>
            {/if}

            <dt class="text-muted-foreground">Tags</dt>
            <dd>
              {#if data.tags.length > 0}
                <span class="flex flex-wrap gap-1">
                  {#each data.tags as tag (tag.id)}
                    <TagBadge name={tag.name} color={tag.color} href={paths.deployments({ tag_id: tag.id })} />
                  {/each}
                </span>
              {:else}
                —
              {/if}
            </dd>
          </dl>

          <div class="mt-4 flex flex-col gap-2 border-t pt-3 text-sm">
            <a href={paths.deployments({ commit_id: data.commit.id })} class="text-brand hover:underline">
              All records of this commit
            </a>
            <a href={paths.projectCompare(data.project_id)} class="text-brand hover:underline">
              Compare environments of {data.project.name}
            </a>
          </div>
        </section>
      </aside>
    </div>

    <DeploymentFormDialog bind:open={editOpen} deployment={data} />
  {/if}
</div>
