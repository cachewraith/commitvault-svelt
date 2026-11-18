<!--
  Deployment history: every recorded deployment as a timeline grouped by day,
  newest first. Filters live in the query string, so views such as "failed
  records in production" or "records of this commit" are linkable. A record
  opens in a side panel (`?view=<id>`) over the list.
-->
<script lang="ts">
  import { createQuery, keepPreviousData } from '@tanstack/svelte-query';
  import GitCompareIcon from '@lucide/svelte/icons/git-compare-arrows';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import RocketIcon from '@lucide/svelte/icons/rocket';
  import XIcon from '@lucide/svelte/icons/x';
  import { queryKeys } from '$lib/api';
  import {
    DateRangeFilter,
    EmptyState,
    ErrorState,
    FilterBar,
    ListSkeleton,
    MoreFilters,
    PageHeader,
    Pagination,
    STATUS_PRESENTATION,
    SearchInput,
  } from '$lib/components';
  import { Button } from '$lib/components/ui/button';
  import { queryEnum, queryNumber, queryString, setQuery } from '$lib/router';
  import { DEPLOYMENT_STATUSES } from '$lib/types';
  import { commitsApi } from '$features/commits/api';
  import FilterSelect from '$features/commits/components/FilterSelect.svelte';
  import EnvironmentSelect from '$features/environments/components/EnvironmentSelect.svelte';
  import ProjectSelect from '$features/projects/components/ProjectSelect.svelte';
  import TagSelect from '$features/tags/components/TagSelect.svelte';
  import { paths } from '$routes/paths';
  import { deploymentsApi, type DeploymentListParams } from '../api';
  import DeploymentFormDialog from '../components/DeploymentFormDialog.svelte';
  import DeploymentTimeline from '../components/DeploymentTimeline.svelte';

  const PER_PAGE = 25;

  const page = queryNumber('page', 1);
  const search = queryString('search');
  const projectId = queryString('project_id');
  const environmentId = queryString('environment_id');
  const commitId = queryString('commit_id');
  const status = queryEnum('status', DEPLOYMENT_STATUSES);
  const dateFrom = queryString('date_from');
  const dateTo = queryString('date_to');
  const tagId = queryString('tag_id');
  const order = queryEnum('order', ['asc', 'desc'], 'desc');

  const params = $derived<DeploymentListParams>({
    page: page.value,
    per_page: PER_PAGE,
    search: search.value || undefined,
    project_id: projectId.value || undefined,
    environment_id: environmentId.value || undefined,
    commit_id: commitId.value || undefined,
    status: status.value,
    date_from: dateFrom.value || undefined,
    date_to: dateTo.value || undefined,
    tag_id: tagId.value || undefined,
    sort: 'deployed_at',
    order: order.value,
  });

  const deployments = createQuery(() => ({
    queryKey: queryKeys.deployments.list(params),
    queryFn: ({ signal }) => deploymentsApi.list(params, signal),
    placeholderData: keepPreviousData,
  }));

  // Only to name the commit in the filter chip.
  const commit = createQuery(() => ({
    queryKey: queryKeys.commits.detail(commitId.value),
    queryFn: ({ signal }) => commitsApi.get(commitId.value, signal),
    enabled: commitId.value !== '',
    staleTime: 60_000,
  }));

  const statusOptions = DEPLOYMENT_STATUSES.map((value) => ({ value, label: STATUS_PRESENTATION[value].label }));

  const filtersActive = $derived(
    search.value !== '' ||
      projectId.value !== '' ||
      environmentId.value !== '' ||
      commitId.value !== '' ||
      status.value !== undefined ||
      dateFrom.value !== '' ||
      dateTo.value !== '' ||
      tagId.value !== '',
  );

  function resetFilters() {
    setQuery({
      search: null,
      project_id: null,
      environment_id: null,
      commit_id: null,
      status: null,
      date_from: null,
      date_to: null,
      tag_id: null,
      page: null,
    });
  }

  const moreActive = $derived([dateFrom.value || dateTo.value, tagId.value].filter((value) => value !== '').length);

  let createOpen = $state(false);
</script>

<div class="page">
  <PageHeader
    title="Deployment history"
  >
    {#snippet actions()}
      {#if projectId.value !== ''}
        <Button variant="outline" href={paths.projectCompare(projectId.value)}>
          <GitCompareIcon aria-hidden="true" />
          Compare environments
        </Button>
      {/if}
      <Button onclick={() => (createOpen = true)}>
        <PlusIcon aria-hidden="true" />
        Record deployment
      </Button>
    {/snippet}
  </PageHeader>

  <FilterBar active={filtersActive} onreset={resetFilters} label="Deployment filters">
    <SearchInput
      value={search.value}
      onsearch={(q) => setQuery({ search: q, page: null })}
      label="Search deployment records"
      placeholder="Search title, notes, commit message or hash…"
      class="w-full sm:w-72"
    />
    <ProjectSelect
      value={projectId.value || null}
      onchange={(next) => setQuery({ project_id: next, environment_id: null, page: null })}
      placeholder="All projects"
      clearable
      includeArchived
      class="w-full sm:w-52"
    />
    {#if projectId.value !== ''}
      <EnvironmentSelect
        projectId={projectId.value}
        value={environmentId.value || null}
        onchange={(next) => setQuery({ environment_id: next, page: null })}
        placeholder="All environments"
        clearable
        class="w-full sm:w-52"
      />
    {/if}
    <FilterSelect
      value={status.value}
      options={statusOptions}
      onchange={(next) => setQuery({ status: next ?? null, page: null })}
      label="Status"
      allLabel="Any status"
      class="sm:w-40"
    />
    <MoreFilters activeCount={moreActive}>
      <DateRangeFilter
        from={dateFrom.value}
        to={dateTo.value}
        onchange={({ from, to }) => setQuery({ date_from: from, date_to: to, page: null })}
        label="Deployed"
      />
      <TagSelect
        value={tagId.value || null}
        onchange={(next) => setQuery({ tag_id: next, page: null })}
        placeholder="Any tag"
        class="w-full"
      />
    </MoreFilters>
    {#if commitId.value !== ''}
      <span class="bg-muted text-foreground inline-flex h-8 max-w-full items-center gap-1.5 rounded-lg border pr-1 pl-2.5 text-sm">
        <span class="text-muted-foreground shrink-0">Commit</span>
        <a href={paths.commit(commitId.value)} class="hover:text-brand truncate font-mono text-xs">
          {commit.data?.short_hash ?? '…'}
        </a>
        <button
          type="button"
          class="text-muted-foreground hover:text-foreground flex size-5 shrink-0 items-center justify-center rounded-sm"
          aria-label="Remove commit filter"
          onclick={() => setQuery({ commit_id: null, page: null })}
        >
          <XIcon class="size-3.5" aria-hidden="true" />
        </button>
      </span>
    {/if}
  </FilterBar>

  {#if deployments.isPending}
    <ListSkeleton rows={8} />
  {:else if deployments.isError}
    <ErrorState error={deployments.error} onretry={() => deployments.refetch()} retrying={deployments.isFetching} />
  {:else if deployments.data.data.length === 0}
    {#if filtersActive}
      <EmptyState
        icon={RocketIcon}
        title="No deployment records match these filters"
        description="No matching record exists in CommitVault. Try a wider date range or remove a filter."
      >
        {#snippet action()}
          <Button variant="outline" onclick={resetFilters}>Clear filters</Button>
        {/snippet}
      </EmptyState>
    {:else}
      <EmptyState
        icon={RocketIcon}
        title="No deployments recorded yet"
        description="When you deploy a commit to an environment, record it here to build a history you can look back on."
      >
        {#snippet action()}
          <Button onclick={() => (createOpen = true)}>
            <PlusIcon aria-hidden="true" />
            Record deployment
          </Button>
        {/snippet}
      </EmptyState>
    {/if}
  {:else}
    <DeploymentTimeline
      deployments={deployments.data.data}
      showProject={projectId.value === ''}
      showEnvironment={environmentId.value === ''}
      showCommit={commitId.value === ''}
      label="Deployment history"
      groupByDay
    />
    <div class="mt-6 border-t pt-3">
      <Pagination meta={deployments.data.meta} onchange={(next) => (page.value = next)} label="records" />
    </div>
  {/if}
</div>

<DeploymentFormDialog
  bind:open={createOpen}
  projectId={projectId.value || undefined}
  environmentId={projectId.value !== '' && environmentId.value !== '' ? environmentId.value : undefined}
  commitId={projectId.value !== '' && commitId.value !== '' ? commitId.value : undefined}
/>
