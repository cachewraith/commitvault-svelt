<!--
  Commits across all projects: a dense, URL-driven table. Every filter lives in
  the query string, so a filtered view can be bookmarked or linked from other
  screens (`?project_id=`, `?tag_id=`, `?release_id=`…).
-->
<script lang="ts">
  import { createQuery, keepPreviousData } from '@tanstack/svelte-query';
  import GitCommitIcon from '@lucide/svelte/icons/git-commit-horizontal';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import XIcon from '@lucide/svelte/icons/x';
  import { queryKeys, type SortOrder } from '$lib/api';
  import {
    BranchBadge,
    Combobox,
    DataTable,
    DataTableBody,
    DataTableCell,
    DataTableHead,
    DataTableHeader,
    DataTableRow,
    DateRangeFilter,
    DateTime,
    EmptyState,
    ErrorState,
    FilterBar,
    HashChip,
    PageHeader,
    Pagination,
    SearchInput,
    TableSkeleton,
    TagBadge,
  } from '$lib/components';
  import { Button } from '$lib/components/ui/button';
  import { queryEnum, queryNumber, queryString, setQuery } from '$lib/router';
  import EnvironmentSelect from '$features/environments/components/EnvironmentSelect.svelte';
  import ProjectSelect from '$features/projects/components/ProjectSelect.svelte';
  import { releasesApi } from '$features/releases/api';
  import TagSelect from '$features/tags/components/TagSelect.svelte';
  import { paths } from '$routes/paths';
  import { commitsApi, type CommitListParams } from '../api';
  import CommitDeploymentBadges from '../components/CommitDeploymentBadges.svelte';
  import CommitFormDialog from '../components/CommitFormDialog.svelte';
  import FilterSelect from '../components/FilterSelect.svelte';
  import { DEPLOYMENT_FILTER_LABELS, commitSubject } from '../format';
  import { COMMIT_DEPLOYMENT_FILTERS, type CommitSort } from '../types';

  const SORTS = ['commit_date', 'created_at', 'branch_name'] as const satisfies readonly CommitSort[];
  const PER_PAGE = 25;

  const page = queryNumber('page', 1);
  const search = queryString('search');
  const projectId = queryString('project_id');
  const branch = queryString('branch');
  const dateFrom = queryString('date_from');
  const dateTo = queryString('date_to');
  const deployment = queryEnum('deployment_status', COMMIT_DEPLOYMENT_FILTERS);
  const environmentId = queryString('environment_id');
  const tagId = queryString('tag_id');
  const releaseId = queryString('release_id');
  const sort = queryEnum('sort', SORTS, 'commit_date');
  const order = queryEnum('order', ['asc', 'desc'], 'desc');

  const params = $derived<CommitListParams>({
    page: page.value,
    per_page: PER_PAGE,
    search: search.value || undefined,
    project_id: projectId.value || undefined,
    branch: branch.value || undefined,
    date_from: dateFrom.value || undefined,
    date_to: dateTo.value || undefined,
    deployment_status: deployment.value,
    environment_id: environmentId.value || undefined,
    tag_id: tagId.value || undefined,
    release_id: releaseId.value || undefined,
    sort: sort.value,
    order: order.value,
  });

  const commits = createQuery(() => ({
    queryKey: queryKeys.commits.list(params),
    queryFn: ({ signal }) => commitsApi.list(params, signal),
    placeholderData: keepPreviousData,
  }));

  const branches = createQuery(() => ({
    queryKey: [...queryKeys.commits.all, 'branches', projectId.value] as const,
    queryFn: ({ signal }) => commitsApi.branches(projectId.value, signal),
    enabled: projectId.value !== '',
    staleTime: 60_000,
  }));

  // Only to name the release in the filter chip.
  const release = createQuery(() => ({
    queryKey: queryKeys.releases.detail(releaseId.value),
    queryFn: ({ signal }) => releasesApi.get(releaseId.value, signal),
    enabled: releaseId.value !== '',
    staleTime: 60_000,
  }));

  const branchOptions = $derived.by(() => {
    const options = (branches.data ?? []).map((item) => ({
      value: item.name,
      label: item.name,
      description: `${item.commit_count} ${item.commit_count === 1 ? 'commit' : 'commits'}`,
    }));
    // Keep a deep-linked branch selectable even when it is not in the list.
    if (branch.value && !options.some((option) => option.value === branch.value)) {
      options.unshift({ value: branch.value, label: branch.value, description: '' });
    }
    return options;
  });

  const deploymentOptions = COMMIT_DEPLOYMENT_FILTERS.map((value) => ({
    value,
    label: DEPLOYMENT_FILTER_LABELS[value],
  }));

  const filtersActive = $derived(
    search.value !== '' ||
      projectId.value !== '' ||
      branch.value !== '' ||
      dateFrom.value !== '' ||
      dateTo.value !== '' ||
      deployment.value !== undefined ||
      environmentId.value !== '' ||
      tagId.value !== '' ||
      releaseId.value !== '',
  );

  function resetFilters() {
    setQuery({
      search: null,
      project_id: null,
      branch: null,
      date_from: null,
      date_to: null,
      deployment_status: null,
      environment_id: null,
      tag_id: null,
      release_id: null,
      page: null,
    });
  }

  function onsort(nextSort: string, nextOrder: SortOrder) {
    setQuery({
      sort: nextSort === 'commit_date' ? null : nextSort,
      order: nextOrder === 'desc' ? null : nextOrder,
      page: null,
    });
  }

  let createOpen = $state(false);
</script>

<div class="page">
  <PageHeader title="Commits" description="Commits you recorded by hand, across all projects.">
    {#snippet actions()}
      <Button onclick={() => (createOpen = true)}>
        <PlusIcon aria-hidden="true" />
        Record commit
      </Button>
    {/snippet}
  </PageHeader>

  <FilterBar active={filtersActive} onreset={resetFilters} label="Commit filters">
    <SearchInput
      value={search.value}
      onsearch={(q) => setQuery({ search: q, page: null })}
      label="Search commits"
      placeholder="Search message, branch, author or hash…"
      class="w-full sm:w-72"
    />
    <ProjectSelect
      value={projectId.value || null}
      onchange={(next) => setQuery({ project_id: next, branch: null, environment_id: null, page: null })}
      placeholder="All projects"
      clearable
      includeArchived
      class="w-full sm:w-52"
    />
    {#if projectId.value !== ''}
      <Combobox
        options={branchOptions}
        value={branch.value || null}
        onchange={(next) => setQuery({ branch: next, page: null })}
        placeholder="All branches"
        searchPlaceholder="Search branches…"
        emptyText="No branches recorded."
        loading={branches.isPending}
        clearable
        aria-label="Branch"
        class="w-full sm:w-52"
      />
      <EnvironmentSelect
        projectId={projectId.value}
        value={environmentId.value || null}
        onchange={(next) => setQuery({ environment_id: next, page: null })}
        placeholder="Any environment"
        clearable
        class="w-full sm:w-52"
      />
    {/if}
    <FilterSelect
      value={deployment.value}
      options={deploymentOptions}
      onchange={(next) => setQuery({ deployment_status: next ?? null, page: null })}
      label="Recorded deployments"
      allLabel="Any deployment records"
    />
    <DateRangeFilter
      from={dateFrom.value}
      to={dateTo.value}
      onchange={({ from, to }) => setQuery({ date_from: from, date_to: to, page: null })}
      label="Commit date"
    />
    <TagSelect
      value={tagId.value || null}
      onchange={(next) => setQuery({ tag_id: next, page: null })}
      placeholder="Any tag"
      class="w-full sm:w-44"
    />
    {#if releaseId.value !== ''}
      <span class="bg-muted text-foreground inline-flex h-8 items-center gap-1.5 rounded-lg border pr-1 pl-2.5 text-sm">
        <span class="text-muted-foreground">In release</span>
        <span class="font-mono text-xs">{release.data?.version ?? '…'}</span>
        <button
          type="button"
          class="text-muted-foreground hover:text-foreground flex size-5 items-center justify-center rounded-sm"
          aria-label="Remove release filter"
          onclick={() => setQuery({ release_id: null, page: null })}
        >
          <XIcon class="size-3.5" aria-hidden="true" />
        </button>
      </span>
    {/if}
  </FilterBar>

  {#if commits.isPending}
    <TableSkeleton rows={10} columns={6} />
  {:else if commits.isError}
    <ErrorState error={commits.error} onretry={() => commits.refetch()} retrying={commits.isFetching} />
  {:else if commits.data.data.length === 0}
    {#if filtersActive}
      <EmptyState
        icon={GitCommitIcon}
        title="No commits match these filters"
        description="Try a different search term or remove a filter."
      >
        {#snippet action()}
          <Button variant="outline" onclick={resetFilters}>Clear filters</Button>
        {/snippet}
      </EmptyState>
    {:else}
      <EmptyState
        icon={GitCommitIcon}
        title="No commits recorded yet"
        description="Record a commit with its branch and hash so you can note where it was deployed later."
      >
        {#snippet action()}
          <Button onclick={() => (createOpen = true)}>
            <PlusIcon aria-hidden="true" />
            Record commit
          </Button>
        {/snippet}
      </EmptyState>
    {/if}
  {:else}
    <DataTable label="Commits">
      <DataTableHeader>
        <DataTableRow>
          <DataTableHead>Hash</DataTableHead>
          <DataTableHead>Message</DataTableHead>
          <DataTableHead sortKey="branch_name" sort={sort.value} order={order.value} {onsort} defaultOrder="asc">
            Branch
          </DataTableHead>
          <DataTableHead>Project</DataTableHead>
          <DataTableHead sortKey="commit_date" sort={sort.value} order={order.value} {onsort} defaultOrder="desc">
            Commit date
          </DataTableHead>
          <DataTableHead>Recorded deployments</DataTableHead>
        </DataTableRow>
      </DataTableHeader>
      <DataTableBody>
        {#each commits.data.data as commit (commit.id)}
          <DataTableRow href={paths.commit(commit.id)}>
            <DataTableCell>
              <HashChip hash={commit.commit_hash} short={commit.short_hash} externalUrl={commit.external_url} />
            </DataTableCell>
            <DataTableCell class="max-w-sm min-w-56">
              <a
                href={paths.commit(commit.id)}
                class="text-foreground hover:text-brand block truncate font-medium"
                title={commitSubject(commit.commit_message)}
              >
                {commitSubject(commit.commit_message)}
              </a>
              {#if commit.author_name || commit.tags.length > 0}
                <span class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  {#if commit.author_name}
                    <span class="text-muted-foreground text-xs">{commit.author_name}</span>
                  {/if}
                  {#each commit.tags as tag (tag.id)}
                    <TagBadge name={tag.name} color={tag.color} href={paths.commits({ tag_id: tag.id })} />
                  {/each}
                </span>
              {/if}
            </DataTableCell>
            <DataTableCell>
              <BranchBadge
                name={commit.branch_name}
                href={paths.commits({ project_id: commit.project_id, branch: commit.branch_name })}
              />
            </DataTableCell>
            <DataTableCell>
              <a href={paths.project(commit.project.id)} class="text-muted-foreground hover:text-foreground">
                {commit.project.name}
              </a>
            </DataTableCell>
            <DataTableCell class="tabular text-muted-foreground">
              <DateTime value={commit.commit_date} mode="date" />
            </DataTableCell>
            <DataTableCell wrap class="min-w-64">
              <CommitDeploymentBadges environments={commit.environments} />
            </DataTableCell>
          </DataTableRow>
        {/each}
      </DataTableBody>
      {#snippet footer()}
        <Pagination meta={commits.data.meta} onchange={(next) => (page.value = next)} label="commits" />
      {/snippet}
    </DataTable>
  {/if}
</div>

<CommitFormDialog bind:open={createOpen} projectId={projectId.value || undefined} />
