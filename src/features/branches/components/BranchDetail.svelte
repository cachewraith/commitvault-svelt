<!--
  One branch: where its commits have recorded deployments (latest record per
  environment) and its commits, newest first. Full page or side panel.
-->
<script lang="ts">
  import { createMutation, createQuery, keepPreviousData, useQueryClient } from '@tanstack/svelte-query';
  import GitCommitIcon from '@lucide/svelte/icons/git-commit-horizontal';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import TrashIcon from '@lucide/svelte/icons/trash';
  import { isApiError, queryKeys, removeFromCache } from '$lib/api';
  import {
    DateTime,
    DetailSkeleton,
    EmptyState,
    EnvironmentBadge,
    ErrorState,
    ListSkeleton,
    PageHeader,
    Pagination,
    toast,
    toastError,
  } from '$lib/components';
  import { Button } from '$lib/components/ui/button';
  import { navigate, queryNumber, setPageTitle } from '$lib/router';
  import { formatNumber, pluralize } from '$lib/utils';
  import { paths } from '$routes/paths';
  import { commitsApi } from '$features/commits/api';
  import CommitFormDialog from '$features/commits/components/CommitFormDialog.svelte';
  import CommitList from '$features/commits/components/CommitList.svelte';
  import LatestDeployment from '$features/environments/components/LatestDeployment.svelte';
  import { branchesApi } from '../api';
  import BranchFormDialog from './BranchFormDialog.svelte';
  import { confirmBranchDeletion } from '../delete';
  import { invalidateBranches } from '../queries';

  interface Props {
    branchId: string;
    layout?: 'page' | 'panel';
    /** After a successful delete. Default: go to the project's branch list. */
    ondeleted?: () => void;
  }

  let { branchId, layout = 'page', ondeleted }: Props = $props();
  const isPage = $derived(layout === 'page');

  const queryClient = useQueryClient();
  // The panel pages its commit list locally; the full page keeps it in the URL.
  const urlPage = queryNumber('page', 1);
  let localPage = $state(1);
  const page = {
    get value() {
      return isPage ? urlPage.value : localPage;
    },
    set value(next: number) {
      if (isPage) urlPage.value = next;
      else localPage = next;
    },
  };

  const branch = createQuery(() => ({
    queryKey: queryKeys.branches.detail(branchId),
    queryFn: ({ signal }) => branchesApi.get(branchId, signal),
  }));

  const commitParams = $derived({ branch_id: branchId, page: page.value, per_page: 20 });
  const commits = createQuery(() => ({
    queryKey: queryKeys.commits.list(commitParams),
    queryFn: ({ signal }) => commitsApi.list(commitParams, signal),
    placeholderData: keepPreviousData,
  }));

  $effect(() => {
    if (isPage && branch.data) setPageTitle(`${branch.data.name} · ${branch.data.project.name}`);
  });

  let editOpen = $state(false);
  let commitOpen = $state(false);

  const remove = createMutation(() => ({
    mutationFn: (cascade: boolean) => branchesApi.remove(branchId, { cascade }),
    // Optimistic: gone from every list at once; restored if the server refuses.
    onMutate: () => {
      const current = branch.data;
      const restore = removeFromCache(queryClient, branchId, [queryKeys.branches.lists()]);
      toast.success(`Branch “${current?.name ?? ''}” deleted`);
      if (ondeleted) ondeleted();
      else if (current) navigate(paths.projectBranches(current.project_id), { replace: true });
      return { restore };
    },
    onSuccess: () => queryClient.removeQueries({ queryKey: queryKeys.branches.detail(branchId) }),
    onError: (error: unknown, _cascade, context) => {
      context?.restore();
      toastError(error, 'Could not delete the branch. It is back in the list.');
    },
    onSettled: () => invalidateBranches(queryClient),
  }));

  async function confirmRemove() {
    if (!branch.data) return;
    const answer = await confirmBranchDeletion(branch.data);
    if (answer) remove.mutate(answer.cascade);
  }
</script>

<div>
  {#if branch.isPending}
    <DetailSkeleton />
  {:else if branch.isError}
    {#if isPage}
      <PageHeader title="Branch" breadcrumbs={[{ label: 'Projects', href: paths.projects() }, { label: 'Branch' }]} />
    {/if}
    <ErrorState
      error={branch.error}
      title={isApiError(branch.error) && branch.error.isNotFound ? 'Branch not found' : undefined}
      onretry={() => branch.refetch()}
      retrying={branch.isFetching}
    />
  {:else}
    {@const current = branch.data}
    {#snippet metaLine()}
    <div class="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      {#if current.is_default}
        <span class="rounded-md border px-1.5 text-xs">default branch</span>
      {/if}
      <span class="tabular">{pluralize(current.commit_count, 'commit')}</span>
      {#if current.last_commit_at}
        <span>latest <DateTime value={current.last_commit_at} mode="date" /></span>
      {/if}
    </div>
    {/snippet}
    {#snippet actionButtons(compact: boolean)}
    <Button size={compact ? 'sm' : 'default'} onclick={() => (commitOpen = true)}>
      <PlusIcon aria-hidden="true" />
      Record commit
    </Button>
    <Button variant="outline" size={compact ? 'sm' : 'default'} onclick={() => (editOpen = true)}>
      <PencilIcon aria-hidden="true" />
      Edit
    </Button>
    <Button variant="outline" size={compact ? 'icon-sm' : 'icon'} onclick={confirmRemove} disabled={remove.isPending} aria-label="Delete branch">
      <TrashIcon aria-hidden="true" />
    </Button>
    {/snippet}

    {#if isPage}
      <PageHeader
        title={current.name}
        breadcrumbs={[
          { label: 'Projects', href: paths.projects() },
          { label: current.project.name, href: paths.project(current.project_id) },
          { label: 'Branches', href: paths.projectBranches(current.project_id) },
          { label: current.name },
        ]}
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
        <div class="flex min-w-0 flex-col gap-1">
          <p class="text-muted-foreground text-xs">
            <a href={paths.project(current.project_id)} class="hover:text-foreground">{current.project.name}</a>
          </p>
          <h2 class="text-foreground font-mono text-lg font-semibold break-all">{current.name}</h2>
        </div>
        {@render metaLine()}
        <div class="flex flex-wrap gap-2">{@render actionButtons(true)}</div>
      </header>
    {/if}

    {#if current.description}
      <p class="text-muted-foreground mb-6 max-w-3xl text-sm whitespace-pre-line">{current.description}</p>
    {/if}

    <section class="mb-6 flex flex-col gap-3" aria-labelledby="branch-environments">
      <div>
        <h2 id="branch-environments" class="text-sm font-semibold">Deployments</h2>
        <p class="text-muted-foreground text-xs">
          The latest deployment record of a commit on this branch, per environment. Environments without a record are
          not listed — that does not mean the branch was never deployed there.
        </p>
      </div>
      {#if current.environments.length === 0}
        <EmptyState
          compact
          bordered
          title="No deployment records"
          description="None of this branch's commits has a recorded deployment yet."
        />
      {:else}
        <ul class="bg-card divide-y rounded-lg border" aria-label="Latest deployment record per environment">
          {#each current.environments as environment (environment.id)}
            <li class="flex flex-col gap-x-4 gap-y-2 px-4 py-2.5 sm:flex-row sm:items-center">
              <div class="sm:w-48 sm:shrink-0">
                <EnvironmentBadge
                  name={environment.name}
                  color={environment.color}
                  href={paths.deployments({ project_id: current.project_id, environment_id: environment.id })}
                />
              </div>
              <LatestDeployment deployment={environment.latest_deployment} showMessage class="min-w-0 flex-1" />
              <span class="text-muted-foreground tabular shrink-0 text-xs">
                {pluralize(environment.deployment_count, 'deployment')}
              </span>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="branch-commits">
      <h2 id="branch-commits" class="text-sm font-semibold">
        Commits
        <span class="text-muted-foreground tabular ml-1 font-normal">{formatNumber(current.commit_count)}</span>
      </h2>
      {#if commits.isPending}
        <ListSkeleton rows={5} />
      {:else if commits.isError}
        <ErrorState error={commits.error} onretry={() => commits.refetch()} compact />
      {:else if commits.data.data.length === 0}
        <EmptyState
          compact
          bordered
          icon={GitCommitIcon}
          title="No commits on this branch"
          description="Record a commit on this branch to keep track of it."
        >
          {#snippet action()}
            <Button variant="outline" size="sm" onclick={() => (commitOpen = true)}>Record commit</Button>
          {/snippet}
        </EmptyState>
      {:else}
        <CommitList commits={commits.data.data} showDeployments label="Commits on this branch" />
        <Pagination
          meta={commits.data.meta}
          onchange={(next) => (page.value = next)}
          label="commits"
          hideWhenSinglePage
        />
      {/if}
    </section>

    <BranchFormDialog bind:open={editOpen} projectId={current.project_id} branch={current} />
    <CommitFormDialog
      bind:open={commitOpen}
      projectId={current.project_id}
      branchId={current.id}
      branchName={current.name}
    />
  {/if}
</div>
