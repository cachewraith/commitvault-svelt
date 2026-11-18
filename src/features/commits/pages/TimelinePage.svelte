<!--
  Commits of a date range, grouped under their branch:
  10 Nov 2026 → 17 Nov 2026 › branch › commits. The range, project and page
  live in the URL (`?from=2026-11-10&to=2026-11-17&project_id=`), so a range
  can be bookmarked. Defaults to the last 7 days.
-->
<script lang="ts">
  import { createQuery, keepPreviousData } from '@tanstack/svelte-query';
  import GitBranchIcon from '@lucide/svelte/icons/git-branch';
  import GitCommitIcon from '@lucide/svelte/icons/git-commit-horizontal';
  import { queryKeys } from '$lib/api';
  import {
    DateRangeFilter,
    DateTime,
    EmptyState,
    ErrorState,
    ListSkeleton,
    PageHeader,
    Pagination,
  } from '$lib/components';
  import { Button } from '$lib/components/ui/button';
  import { queryNumber, queryString, setQuery } from '$lib/router';
  import { cn, formatDate, formatDateRange, pluralize, startOfLocalDayIso, toDateInputValue } from '$lib/utils';
  import ProjectSelect from '$features/projects/components/ProjectSelect.svelte';
  import { paths } from '$routes/paths';
  import { commitsApi, type CommitListParams } from '../api';
  import CommitDeploymentBadges from '../components/CommitDeploymentBadges.svelte';
  import { commitSubject } from '../format';
  import {
    groupByBranch,
    matchingPreset,
    PRESET_LABELS,
    presetRange,
    RANGE_PRESETS,
    rangeBounds,
    type DayRange,
    type RangePreset,
  } from '../timeline';

  const PER_PAGE = 100;

  const from = queryString('from');
  const to = queryString('to');
  const projectId = queryString('project_id');
  const page = queryNumber('page', 1);

  const range = $derived<DayRange>(from.value && to.value ? { from: from.value, to: to.value } : presetRange('last-7'));
  const activePreset = $derived(matchingPreset(range));

  const params = $derived<CommitListParams>({
    ...rangeBounds(range),
    project_id: projectId.value || undefined,
    sort: 'branch_name',
    order: 'asc',
    page: page.value,
    per_page: PER_PAGE,
  });

  const commits = createQuery(() => ({
    queryKey: queryKeys.commits.list(params),
    queryFn: ({ signal }) => commitsApi.list(params, signal),
    placeholderData: keepPreviousData,
  }));

  const groups = $derived(commits.data ? groupByBranch(commits.data.data) : []);
  const showProject = $derived(projectId.value === '');
  const title = $derived(formatDateRange(`${range.from}T12:00:00`, `${range.to}T12:00:00`));

  function setRange(next: DayRange) {
    setQuery({ from: next.from, to: next.to, page: null });
  }

  function choosePreset(preset: RangePreset) {
    setRange(presetRange(preset));
  }

  function changeCustom({ from: start, to: end }: { from: string | null; to: string | null }) {
    // Keep the other end when only one side changes; an empty side falls back to the current one.
    setRange({ from: start ? toDateInputValue(start) : range.from, to: end ? toDateInputValue(end) : range.to });
  }

  function span(first: string, last: string): string {
    return formatDate(first) === formatDate(last) ? formatDate(first) : formatDateRange(first, last);
  }
</script>

<div class="page">
  <PageHeader {title} description="Commits in this period, grouped by branch.">
    {#snippet meta()}
      {#if commits.data}
        <p class="text-muted-foreground text-sm tabular">
          {pluralize(commits.data.meta.total, 'commit')}{#if commits.data.meta.total_pages <= 1 && groups.length > 0}{` on ${pluralize(groups.length, 'branch', 'branches')}`}{/if}
        </p>
      {/if}
    {/snippet}
  </PageHeader>

  <div class="mb-6 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
    <div class="bg-muted/40 inline-flex w-fit rounded-lg border p-0.5" role="group" aria-label="Range presets">
      {#each RANGE_PRESETS as preset (preset)}
        <button
          type="button"
          class={cn(
            'h-7 rounded-md px-2.5 text-sm transition-colors',
            activePreset === preset
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground',
          )}
          aria-pressed={activePreset === preset}
          onclick={() => choosePreset(preset)}
        >
          {PRESET_LABELS[preset]}
        </button>
      {/each}
    </div>
    <DateRangeFilter
      from={startOfLocalDayIso(range.from)}
      to={startOfLocalDayIso(range.to)}
      onchange={changeCustom}
      label="Commit date"
    />
    <ProjectSelect
      value={projectId.value || null}
      onchange={(next) => setQuery({ project_id: next, page: null })}
      placeholder="All projects"
      clearable
      includeArchived
      class="w-full sm:w-56"
    />
  </div>

  {#if commits.isPending}
    <ListSkeleton rows={8} />
  {:else if commits.isError}
    <ErrorState error={commits.error} onretry={() => commits.refetch()} retrying={commits.isFetching} />
  {:else if groups.length === 0}
    <EmptyState
      icon={GitCommitIcon}
      title="No commits in this range"
      description="Nothing was recorded with a commit date between these days. Try a wider range."
    >
      {#snippet action()}
        <Button variant="outline" onclick={() => choosePreset('last-30')}>Show the last 30 days</Button>
      {/snippet}
    </EmptyState>
  {:else}
    <div class={cn('flex flex-col', commits.isPlaceholderData && 'opacity-60 transition-opacity')}>
      {#each groups as group (group.key)}
        <section class="border-b py-4 first:pt-0 last:border-b-0" aria-label={`Branch ${group.branch.name}`}>
          <header class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <div class="flex min-w-0 items-center gap-2">
              <GitBranchIcon class="text-muted-foreground size-3.5 shrink-0 self-center" aria-hidden="true" />
              <a href={paths.branch(group.branch.id)} class="hover:text-brand truncate font-mono text-sm font-medium">
                {group.branch.name}
              </a>
              {#if showProject}
                <span class="text-muted-foreground shrink-0 text-xs">{group.project.name}</span>
              {/if}
            </div>
            <span class="text-muted-foreground tabular text-xs">
              {pluralize(group.commits.length, 'commit')} · {span(group.first, group.last)}
            </span>
          </header>

          <ol class="mt-2 ml-1.5 border-l pl-4">
            {#each group.commits as commit (commit.id)}
              <li class="flex flex-col gap-1 py-1.5 sm:flex-row sm:items-center sm:gap-3">
                <span class="text-muted-foreground tabular w-24 shrink-0 text-xs">
                  <DateTime value={commit.commit_date} mode="date" />
                </span>
                <a
                  href={paths.commit(commit.id)}
                  class="text-foreground hover:text-brand min-w-0 flex-1 truncate text-sm"
                  title={commitSubject(commit.commit_message)}
                >
                  {commitSubject(commit.commit_message)}
                </a>
                <code class="text-muted-foreground shrink-0 font-mono text-xs">{commit.short_hash}</code>
                <CommitDeploymentBadges environments={commit.environments} emptyText="" class="shrink-0" />
              </li>
            {/each}
          </ol>
        </section>
      {/each}
    </div>
    <div class="mt-4">
      <Pagination meta={commits.data.meta} onchange={(next) => (page.value = next)} label="commits" hideWhenSinglePage />
    </div>
  {/if}
</div>
