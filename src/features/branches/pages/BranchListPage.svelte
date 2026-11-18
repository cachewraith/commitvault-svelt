<!--
  Branches of one project: commit count and latest commit per branch;
  create, rename and delete. URL-driven search, sort and page.
-->
<script lang="ts">
  import { createMutation, createQuery, keepPreviousData, useQueryClient } from '@tanstack/svelte-query';
  import GitBranchIcon from '@lucide/svelte/icons/git-branch';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import TrashIcon from '@lucide/svelte/icons/trash';
  import { isApiError, queryKeys, removeFromCache, type SortOrder } from '$lib/api';
  import {
    DataTable,
    DataTableBody,
    DataTableCell,
    DataTableHead,
    DataTableHeader,
    DataTableRow,
    DateTime,
    EmptyState,
    ErrorState,
    FilterBar,
    PageHeader,
    Pagination,
    SearchInput,
    TableSkeleton,
    toast,
    toastError,
    SortSelect,
  } from '$lib/components';
  import { Button } from '$lib/components/ui/button';
  import {queryNumber, queryString, setPageTitle, setQuery, type SortOption, sortState} from '$lib/router';
  import { formatNumber } from '$lib/utils';
  import { paths } from '$routes/paths';
  import { projectsApi } from '$features/projects/api';
  import ProjectTabs from '$features/projects/components/ProjectTabs.svelte';
  import { branchesApi, type BranchListParams } from '../api';
  import BranchFormDialog from '../components/BranchFormDialog.svelte';
  import { confirmBranchDeletion } from '../delete';
  import { invalidateBranches } from '../queries';
  import type { Branch, BranchSort } from '../types';

  let { projectId }: { projectId: string } = $props();

  const queryClient = useQueryClient();

  const page = queryNumber('page', 1);
  const search = queryString('search');
  const SORT_OPTIONS = [
    { sort: 'created_at', order: 'desc', label: 'Newest first' },
    { sort: 'created_at', order: 'asc', label: 'Oldest first' },
    { sort: 'last_commit', order: 'desc', label: 'Latest commit' },
    { sort: 'name', order: 'asc', label: 'Name A–Z' },
    { sort: 'name', order: 'desc', label: 'Name Z–A' },
    { sort: 'commits', order: 'desc', label: 'Most commits' },
  ] as const satisfies readonly SortOption<BranchSort>[];
  const sorting = sortState(SORT_OPTIONS);

  const params = $derived<BranchListParams>({
    page: page.value,
    per_page: 25,
    search: search.value || undefined,
    sort: sorting.sort,
    order: sorting.order,
  });

  const project = createQuery(() => ({
    queryKey: queryKeys.projects.detail(projectId),
    queryFn: ({ signal }) => projectsApi.get(projectId, signal),
  }));

  const branches = createQuery(() => ({
    queryKey: queryKeys.branches.list({ projectId, ...params }),
    queryFn: ({ signal }) => branchesApi.list(projectId, params, signal),
    placeholderData: keepPreviousData,
  }));

  $effect(() => {
    if (project.data) setPageTitle(`Branches · ${project.data.name}`);
  });

  let dialogOpen = $state(false);
  let editing = $state.raw<Branch | undefined>(undefined);

  function openCreate() {
    editing = undefined;
    dialogOpen = true;
  }

  function openEdit(branch: Branch) {
    editing = branch;
    dialogOpen = true;
  }

  const remove = createMutation(() => ({
    mutationFn: (input: { branch: Branch; cascade: boolean }) =>
      branchesApi.remove(input.branch.id, { cascade: input.cascade }),
    // Optimistic: the row disappears at once; restored if the server refuses.
    onMutate: (input) => {
      const restore = removeFromCache(queryClient, input.branch.id, [queryKeys.branches.lists()]);
      toast.success(`Branch “${input.branch.name}” deleted`);
      return { restore };
    },
    onError: (error: unknown, _input, context) => {
      context?.restore();
      toastError(error, 'Could not delete the branch. It is back in the list.');
    },
    onSettled: () => invalidateBranches(queryClient),
  }));

  async function confirmRemove(branch: Branch) {
    const answer = await confirmBranchDeletion(branch);
    if (answer) remove.mutate({ branch, cascade: answer.cascade });
  }

  function onsort(nextSort: string, nextOrder: SortOrder) {
    sorting.set(nextSort, nextOrder);
  }

</script>

<div class="page">
  {#if project.isError}
    <PageHeader title="Branches" breadcrumbs={[{ label: 'Projects', href: paths.projects() }, { label: 'Branches' }]} />
    <ErrorState
      error={project.error}
      title={isApiError(project.error) && project.error.isNotFound ? 'Project not found' : undefined}
      onretry={() => project.refetch()}
      retrying={project.isFetching}
    />
  {:else}
    <PageHeader
      title="Branches"
      breadcrumbs={[
        { label: 'Projects', href: paths.projects() },
        { label: project.data?.name ?? 'Project', href: paths.project(projectId) },
        { label: 'Branches' },
      ]}
    >
      {#snippet actions()}
        <Button onclick={openCreate} disabled={!project.isSuccess}>
          <PlusIcon aria-hidden="true" />
          New branch
        </Button>
      {/snippet}
    </PageHeader>

    <ProjectTabs {projectId} />

    <FilterBar active={search.value !== ''} onreset={() => setQuery({ search: null, page: null })} label="Branch filters">
      <SearchInput
        value={search.value}
        onsearch={(q) => setQuery({ search: q, page: null })}
        label="Search branches"
        placeholder="Search branch names…"
        class="w-full sm:w-72"
      />
    {#snippet actions()}
      <SortSelect options={SORT_OPTIONS} state={sorting} label="Sort branches" />
    {/snippet}
  </FilterBar>

    {#if project.isPending || branches.isPending}
      <TableSkeleton rows={6} columns={4} />
    {:else if branches.isError}
      <ErrorState error={branches.error} onretry={() => branches.refetch()} retrying={branches.isFetching} />
    {:else if branches.data.data.length === 0}
      {#if search.value !== ''}
        <EmptyState icon={GitBranchIcon} title="No branches match “{search.value}”" description="Try another name.">
          {#snippet action()}
            <Button variant="outline" onclick={() => setQuery({ search: null, page: null })}>Clear search</Button>
          {/snippet}
        </EmptyState>
      {:else}
        <EmptyState
          icon={GitBranchIcon}
          title="No branches yet"
          description="Create a branch to record commits on it."
        >
          {#snippet action()}
            <Button onclick={openCreate}>
              <PlusIcon aria-hidden="true" />
              New branch
            </Button>
          {/snippet}
        </EmptyState>
      {/if}
    {:else}
      <DataTable label="Branches">
        <DataTableHeader>
          <DataTableRow>
            <DataTableHead sortKey="name" sort={sorting.sort} order={sorting.order} {onsort} defaultOrder="asc">
              Branch
            </DataTableHead>
            <DataTableHead align="right">Commits</DataTableHead>
            <DataTableHead sortKey="last_commit" sort={sorting.sort} order={sorting.order} {onsort} defaultOrder="desc">
              Latest commit
            </DataTableHead>
            <DataTableHead><span class="sr-only">Actions</span></DataTableHead>
          </DataTableRow>
        </DataTableHeader>
        <DataTableBody>
          {#each branches.data.data as branch (branch.id)}
            <DataTableRow href={paths.branch(branch.id)}>
              <DataTableCell class="max-w-md min-w-56">
                <span class="flex min-w-0 items-center gap-2">
                  <GitBranchIcon class="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
                  <a href={paths.branch(branch.id)} class="text-foreground hover:text-brand truncate font-mono text-sm">
                    {branch.name}
                  </a>
                  {#if branch.is_default}
                    <span class="text-muted-foreground shrink-0 rounded-md border px-1.5 text-xs">default</span>
                  {/if}
                </span>
                {#if branch.description}
                  <span class="text-muted-foreground mt-0.5 block truncate pl-5.5 text-xs">{branch.description}</span>
                {/if}
              </DataTableCell>
              <DataTableCell align="right" class="tabular">
                {#if branch.commit_count > 0}
                  <a href={paths.commits({ project_id: projectId, branch_id: branch.id })} class="hover:underline">
                    {formatNumber(branch.commit_count)}
                  </a>
                {:else}
                  <span class="text-muted-foreground">0</span>
                {/if}
              </DataTableCell>
              <DataTableCell class="tabular text-muted-foreground">
                <DateTime value={branch.last_commit_at} mode="date" fallback="No commits" />
              </DataTableCell>
              <DataTableCell align="right">
                <span class="inline-flex gap-0.5">
                  <Button variant="ghost" size="icon-sm" onclick={() => openEdit(branch)} aria-label={`Edit ${branch.name}`}>
                    <PencilIcon aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onclick={() => confirmRemove(branch)}
                    disabled={remove.isPending}
                    aria-label={`Delete ${branch.name}`}
                  >
                    <TrashIcon aria-hidden="true" />
                  </Button>
                </span>
              </DataTableCell>
            </DataTableRow>
          {/each}
        </DataTableBody>
        {#snippet footer()}
          <Pagination meta={branches.data.meta} onchange={(next) => (page.value = next)} label="branches" />
        {/snippet}
      </DataTable>
    {/if}

    <BranchFormDialog bind:open={dialogOpen} {projectId} branch={editing} />
  {/if}
</div>
