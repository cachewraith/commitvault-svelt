<!--
  Every environment across projects with its latest recorded deployments.
  Read-only: environments are created and edited inside their project.
-->
<script lang="ts">
  import { createQuery, keepPreviousData } from '@tanstack/svelte-query';
  import ServerIcon from '@lucide/svelte/icons/server';
  import { queryKeys } from '$lib/api';
  import {
    DataTable,
    DataTableBody,
    DataTableCell,
    DataTableHead,
    DataTableHeader,
    DataTableRow,
    EmptyState,
    EnvironmentBadge,
    ErrorState,
    FilterBar,
    PageHeader,
    Pagination,
    SearchInput,
    TableSkeleton,
    SortSelect,
  } from '$lib/components';
  import { Button } from '$lib/components/ui/button';
  import { queryNumber, queryString, setQuery, sortState, type SortOption } from '$lib/router';
  import { formatNumber } from '$lib/utils';
  import { paths } from '$routes/paths';
  import ProjectSelect from '$features/projects/components/ProjectSelect.svelte';
  import { environmentsApi, type EnvironmentListParams } from '../api';
  import type { EnvironmentSort } from '../types';
  import LatestDeployment from '../components/LatestDeployment.svelte';

  const page = queryNumber('page', 1);
  const search = queryString('search');
  const projectId = queryString('project_id');

  const SORT_OPTIONS = [
    { sort: 'created_at', order: 'desc', label: 'Newest first' },
    { sort: 'created_at', order: 'asc', label: 'Oldest first' },
    { sort: 'name', order: 'asc', label: 'Name A–Z' },
    { sort: 'project', order: 'asc', label: 'Project A–Z' },
    { sort: 'last_deployed_at', order: 'desc', label: 'Latest deployment' },
  ] as const satisfies readonly SortOption<EnvironmentSort>[];
  const sorting = sortState(SORT_OPTIONS);

  const params = $derived<EnvironmentListParams>({
    page: page.value,
    per_page: 25,
    search: search.value || undefined,
    project_id: projectId.value || undefined,
    sort: sorting.sort,
    order: sorting.order,
  });

  const environments = createQuery(() => ({
    queryKey: queryKeys.environments.list(params),
    queryFn: ({ signal }) => environmentsApi.list(params, signal),
    placeholderData: keepPreviousData,
  }));

  const filtered = $derived(search.value !== '' || projectId.value !== '');
</script>

<div class="page">
  <PageHeader title="Environments" description="Where each project runs, and what was deployed there last." />

  <FilterBar active={filtered} onreset={() => setQuery({ search: null, project_id: null, page: null })} label="Environment filters">
    <SearchInput
      value={search.value}
      onsearch={(query) => setQuery({ search: query, page: null })}
      label="Search environments"
      placeholder="Search by name or server label"
      class="w-full sm:w-72"
    />
    <ProjectSelect
      value={projectId.value || null}
      onchange={(id) => setQuery({ project_id: id, page: null })}
      placeholder="All projects"
      aria-label="Filter by project"
      clearable
      includeArchived
      class="w-full sm:w-56"
    />
    {#snippet actions()}
      <SortSelect options={SORT_OPTIONS} state={sorting} label="Sort environments" />
    {/snippet}
  </FilterBar>

  {#if environments.isPending}
    <TableSkeleton rows={6} columns={5} />
  {:else if environments.isError}
    <ErrorState error={environments.error} onretry={() => environments.refetch()} retrying={environments.isFetching} />
  {:else if environments.data.data.length === 0}
    {#if projectId.value !== '' && search.value === ''}
      <EmptyState
        icon={ServerIcon}
        title="This project has no environments yet"
        description="Add the places it is deployed to, so deployments can be recorded against them."
      >
        {#snippet action()}
          <Button href={paths.projectEnvironments(projectId.value)}>Add environment</Button>
        {/snippet}
      </EmptyState>
    {:else if filtered}
      <EmptyState icon={ServerIcon} title="No environments match these filters" description="Try a different search or clear the filters.">
        {#snippet action()}
          <Button variant="outline" onclick={() => setQuery({ search: null, project_id: null, page: null })}>
            Clear filters
          </Button>
        {/snippet}
      </EmptyState>
    {:else}
      <EmptyState
        icon={ServerIcon}
        title="No environments yet"
        description="Environments belong to a project. Open a project and add the places it is deployed to — development, staging, production, or whatever you call them."
      >
        {#snippet action()}
          <Button href={paths.projects()}>Go to projects</Button>
        {/snippet}
      </EmptyState>
    {/if}
  {:else}
    <DataTable label="Environments">
      <DataTableHeader>
        <DataTableRow>
          <DataTableHead>Project</DataTableHead>
          <DataTableHead>Environment</DataTableHead>
          <DataTableHead>Latest recorded deployment</DataTableHead>
          <DataTableHead>Latest recorded as successful</DataTableHead>
          <DataTableHead align="right">Records</DataTableHead>
          <DataTableHead align="right"><span class="sr-only">Actions</span></DataTableHead>
        </DataTableRow>
      </DataTableHeader>
      <DataTableBody>
        {#each environments.data.data as environment (environment.id)}
          <DataTableRow>
            <DataTableCell>
              <a href={paths.project(environment.project.id)} class="text-foreground font-medium hover:underline">
                {environment.project.name}
              </a>
            </DataTableCell>
            <DataTableCell>
              <div class="flex flex-col items-start gap-0.5">
                <EnvironmentBadge
                  name={environment.name}
                  color={environment.color}
                  href={paths.deployments({ project_id: environment.project_id, environment_id: environment.id })}
                />
                {#if environment.server_label}
                  <span class="text-muted-foreground font-mono text-xs">{environment.server_label}</span>
                {/if}
              </div>
            </DataTableCell>
            <DataTableCell>
              <LatestDeployment deployment={environment.latest_deployment} />
            </DataTableCell>
            <DataTableCell>
              {#if environment.latest_successful_deployment && environment.latest_successful_deployment.id === environment.latest_deployment?.id}
                <span class="text-muted-foreground text-sm">Same record</span>
              {:else}
                <LatestDeployment
                  deployment={environment.latest_successful_deployment}
                  emptyText="None recorded"
                  hideStatus
                />
              {/if}
            </DataTableCell>
            <DataTableCell align="right" class="tabular">
              <a
                href={paths.deployments({ project_id: environment.project_id, environment_id: environment.id })}
                class="hover:underline"
                aria-label={`${environment.deployment_count} deployment records for ${environment.name} of ${environment.project.name}`}
              >
                {formatNumber(environment.deployment_count)}
              </a>
            </DataTableCell>
            <DataTableCell align="right">
              <Button variant="ghost" size="sm" href={paths.projectEnvironments(environment.project_id)}>
                Manage<span class="sr-only"> environments of {environment.project.name}</span>
              </Button>
            </DataTableCell>
          </DataTableRow>
        {/each}
      </DataTableBody>
      {#snippet footer()}
        <Pagination meta={environments.data.meta} onchange={(next) => (page.value = next)} label="environments" />
      {/snippet}
    </DataTable>
  {/if}
</div>
