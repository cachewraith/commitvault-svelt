<!--
  Releases across projects. All list state (filters, sort, page) lives in the
  URL so views are linkable: /releases?project_id=…&status=released&commit_id=…
-->
<script lang="ts">
  import { createQuery, keepPreviousData } from '@tanstack/svelte-query';
  import PackageIcon from '@lucide/svelte/icons/package';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import XIcon from '@lucide/svelte/icons/x';
  import { queryKeys, type SortOrder } from '$lib/api';
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
    HashChip,
    PageHeader,
    Pagination,
    SearchInput,
    StatusBadge,
    TableSkeleton,
    TagBadge,
    SortSelect,
  } from '$lib/components';
  import { Button } from '$lib/components/ui/button';
  import * as Select from '$lib/components/ui/select';
  import {navigate, queryEnum, queryNumber, queryString, setQuery, type SortOption, sortState} from '$lib/router';
  import { RELEASE_STATUSES } from '$lib/types';
  import { formatNumber } from '$lib/utils';
  import { paths } from '$routes/paths';
  import { commitsApi } from '$features/commits/api';
  import ProjectSelect from '$features/projects/components/ProjectSelect.svelte';
  import TagSelect from '$features/tags/components/TagSelect.svelte';
  import { releasesApi, type ReleaseListParams } from '../api';
  import ReleaseFormDialog from '../components/ReleaseFormDialog.svelte';
  import type { ReleaseSort, ReleaseStatus } from '../types';

  const STATUS_LABELS: Record<ReleaseStatus, string> = {
    draft: 'Draft',
    released: 'Released',
    deprecated: 'Deprecated',
  };

  const page = queryNumber('page', 1);
  const search = queryString('search');
  const projectId = queryString('project_id');
  const tagId = queryString('tag_id');
  const commitId = queryString('commit_id');
  const status = queryEnum('status', RELEASE_STATUSES);
  const SORT_OPTIONS = [
    { sort: 'created_at', order: 'desc', label: 'Newest first' },
    { sort: 'created_at', order: 'asc', label: 'Oldest first' },
    { sort: 'released_at', order: 'desc', label: 'Released, newest' },
    { sort: 'released_at', order: 'asc', label: 'Released, oldest' },
    { sort: 'version', order: 'asc', label: 'Version A–Z' },
    { sort: 'version', order: 'desc', label: 'Version Z–A' },
    { sort: 'title', order: 'asc', label: 'Title A–Z' },
  ] as const satisfies readonly SortOption<ReleaseSort>[];
  const sorting = sortState(SORT_OPTIONS);

  const params = $derived<ReleaseListParams>({
    page: page.value,
    per_page: 25,
    search: search.value || undefined,
    project_id: projectId.value || undefined,
    tag_id: tagId.value || undefined,
    commit_id: commitId.value || undefined,
    status: status.value,
    sort: sorting.sort,
    order: sorting.order,
  });

  const filtered = $derived(
    Boolean(search.value || projectId.value || tagId.value || commitId.value || status.value),
  );

  const releases = createQuery(() => ({
    queryKey: queryKeys.releases.list(params),
    queryFn: ({ signal }) => releasesApi.list(params, signal),
    placeholderData: keepPreviousData,
  }));

  // Label for the `?commit_id=` deep link ("releases that include this commit").
  const commitFilter = createQuery(() => ({
    queryKey: queryKeys.commits.detail(commitId.value),
    queryFn: ({ signal }) => commitsApi.get(commitId.value, signal),
    enabled: commitId.value !== '',
  }));

  let creating = $state(false);

  function resetFilters() {
    setQuery({ search: null, project_id: null, tag_id: null, commit_id: null, status: null, page: null });
  }

  function onsort(nextSort: string, nextOrder: SortOrder) {
    sorting.set(nextSort, nextOrder);
  }
</script>

<div class="page">
  <PageHeader title="Releases" description="Versions you’ve shipped, and which commits went into each.">
    {#snippet actions()}
      <Button onclick={() => (creating = true)}>
        <PlusIcon aria-hidden="true" />
        New release
      </Button>
    {/snippet}
  </PageHeader>

  <FilterBar active={filtered} onreset={resetFilters} label="Release filters">
    <SearchInput
      value={search.value}
      onsearch={(q) => setQuery({ search: q, page: null })}
      label="Search releases"
      placeholder="Search version, title, notes…"
      class="w-full sm:w-64"
    />
    <ProjectSelect
      value={projectId.value || null}
      onchange={(id) => setQuery({ project_id: id, page: null })}
      placeholder="Any project"
      clearable
      includeArchived
      class="w-full sm:w-48"
    />
    <Select.Root
      type="single"
      value={status.value ?? 'all'}
      onValueChange={(next) => setQuery({ status: next === 'all' ? null : next, page: null })}
    >
      <Select.Trigger class="w-full sm:w-36" aria-label="Status">
        {status.value ? STATUS_LABELS[status.value] : 'Any status'}
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="all" label="Any status" />
        {#each RELEASE_STATUSES as value (value)}
          <Select.Item {value} label={STATUS_LABELS[value]} />
        {/each}
      </Select.Content>
    </Select.Root>
    <TagSelect
      value={tagId.value || null}
      onchange={(id) => setQuery({ tag_id: id, page: null })}
      placeholder="Any tag"
      class="w-full sm:w-40"
    />
    {#if commitId.value}
      <span class="bg-card inline-flex h-8 items-center gap-1.5 rounded-lg border pr-1 pl-2.5 text-sm">
        <span class="text-muted-foreground">Includes commit</span>
        {#if commitFilter.data}
          <HashChip
            hash={commitFilter.data.commit_hash}
            short={commitFilter.data.short_hash}
            href={paths.commit(commitFilter.data.id)}
            copyable={false}
          />
        {:else}
          <span class="font-mono text-xs">{commitId.value.slice(0, 8)}</span>
        {/if}
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Remove commit filter"
          onclick={() => setQuery({ commit_id: null, page: null })}
        >
          <XIcon aria-hidden="true" />
        </Button>
      </span>
    {/if}
    {#snippet actions()}
      <SortSelect options={SORT_OPTIONS} state={sorting} label="Sort releases" />
    {/snippet}
  </FilterBar>

  {#if releases.isPending}
    <TableSkeleton rows={8} columns={7} />
  {:else if releases.isError}
    <ErrorState error={releases.error} onretry={() => releases.refetch()} retrying={releases.isFetching} />
  {:else if releases.data.data.length === 0}
    {#if filtered}
      <EmptyState
        icon={PackageIcon}
        title="No releases match these filters"
        description="Try a different search term or clear the filters."
      >
        {#snippet action()}
          <Button variant="outline" onclick={resetFilters}>Clear filters</Button>
        {/snippet}
      </EmptyState>
    {:else}
      <EmptyState
        icon={PackageIcon}
        title="No releases yet"
        description="A release groups the commits that shipped together under a version, with notes you write yourself."
      >
        {#snippet action()}
          <Button onclick={() => (creating = true)}>
            <PlusIcon aria-hidden="true" />
            New release
          </Button>
        {/snippet}
      </EmptyState>
    {/if}
  {:else}
    <DataTable label="Releases">
      <DataTableHeader>
        <DataTableRow>
          <DataTableHead sortKey="version" sort={sorting.sort} order={sorting.order} {onsort} defaultOrder="asc">
            Version
          </DataTableHead>
          <DataTableHead>Title</DataTableHead>
          <DataTableHead>Project</DataTableHead>
          <DataTableHead>Status</DataTableHead>
          <DataTableHead sortKey="released_at" sort={sorting.sort} order={sorting.order} {onsort}>Released</DataTableHead>
          <DataTableHead align="right">Commits</DataTableHead>
          <DataTableHead>Tags</DataTableHead>
        </DataTableRow>
      </DataTableHeader>
      <DataTableBody>
        {#each releases.data.data as release (release.id)}
          <DataTableRow href={paths.release(release.id)}>
            <DataTableCell>
              <span class="font-mono text-[0.8125rem] font-medium">{release.version}</span>
            </DataTableCell>
            <DataTableCell class="max-w-[28rem]">
              <a
                href={paths.release(release.id)}
                class="text-foreground block truncate font-medium hover:underline"
              >
                {release.title}
              </a>
              {#if release.description}
                <span class="text-muted-foreground block truncate text-xs">{release.description}</span>
              {/if}
            </DataTableCell>
            <DataTableCell>
              <a href={paths.project(release.project.id)} class="text-muted-foreground hover:text-foreground">
                {release.project.name}
              </a>
            </DataTableCell>
            <DataTableCell><StatusBadge status={release.status} /></DataTableCell>
            <DataTableCell class="tabular">
              {#if release.released_at}
                <DateTime value={release.released_at} mode="date" />
              {:else}
                <span class="text-muted-foreground">Not released</span>
              {/if}
            </DataTableCell>
            <DataTableCell align="right" class="tabular">{formatNumber(release.commit_count)}</DataTableCell>
            <DataTableCell>
              <span class="flex flex-wrap gap-1">
                {#each release.tags as tag (tag.id)}
                  <TagBadge name={tag.name} color={tag.color} />
                {/each}
              </span>
            </DataTableCell>
          </DataTableRow>
        {/each}
      </DataTableBody>
      {#snippet footer()}
        <Pagination meta={releases.data.meta} onchange={(next) => (page.value = next)} label="releases" />
      {/snippet}
    </DataTable>
  {/if}
</div>

<ReleaseFormDialog
  bind:open={creating}
  projectId={projectId.value || undefined}
  onsaved={(release) => navigate(paths.release(release.id))}
/>
