<!--
  Side-by-side comparison of the deployment *records* of two environments of a
  project (`?base=&target=&all=`).

  The result is strictly about what was recorded in CommitVault: a commit
  listed under "Recorded in A only" has no record in B — which does not prove
  it is not deployed there — and no ordering between environments is implied.
  The API's notice is shown verbatim with every result.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { createQuery, keepPreviousData } from '@tanstack/svelte-query';
  import ArrowLeftRightIcon from '@lucide/svelte/icons/arrow-left-right';
  import GitCompareIcon from '@lucide/svelte/icons/git-compare-arrows';
  import InfoIcon from '@lucide/svelte/icons/info';
  import { isApiError, queryKeys } from '$lib/api';
  import {
    BranchBadge,
    DateTime,
    DetailSkeleton,
    EmptyState,
    EnvironmentBadge,
    ErrorState,
    HashChip,
    PageHeader,
    STATUS_PRESENTATION,
    StatusBadge,
  } from '$lib/components';
  import { Button } from '$lib/components/ui/button';
  import { Switch } from '$lib/components/ui/switch';
  import { queryBoolean, queryString, setPageTitle, setQuery } from '$lib/router';
  import { formatNumber, pluralize } from '$lib/utils/format';
  import { commitSubject } from '$features/commits/format';
  import type { CommitBrief } from '$features/commits/types';
  import { environmentsApi } from '$features/environments/api';
  import EnvironmentSelect from '$features/environments/components/EnvironmentSelect.svelte';
  import { projectsApi } from '$features/projects/api';
  import { paths } from '$routes/paths';
  import { deploymentsApi } from '../api';
  import type { ComparisonSide } from '../types';

  let { projectId }: { projectId: string } = $props();

  const uid = $props.id();
  const base = queryString('base');
  const target = queryString('target');
  const includeAll = queryBoolean('all');

  const project = createQuery(() => ({
    queryKey: queryKeys.projects.detail(projectId),
    queryFn: ({ signal }) => projectsApi.get(projectId, signal),
  }));

  const environments = createQuery(() => ({
    queryKey: queryKeys.environments.byProject(projectId),
    queryFn: ({ signal }) => environmentsApi.listForProject(projectId, signal),
  }));

  $effect(() => {
    if (project.data) setPageTitle(`Compare environments · ${project.data.name}`);
  });

  // Start with the first two environments (display order) so the page is useful
  // immediately; the choice is written to the URL and can be changed freely.
  $effect(() => {
    const list = environments.data;
    if (!list || list.length < 2) return;
    untrack(() => {
      if (base.value === '' && target.value === '') setQuery({ base: list[0]!.id, target: list[1]!.id });
    });
  });

  const ready = $derived(base.value !== '' && target.value !== '' && base.value !== target.value);
  const compareParams = $derived({ base: base.value, target: target.value, include_unsuccessful: includeAll.value });

  const comparison = createQuery(() => ({
    queryKey: queryKeys.environments.compare(projectId, compareParams),
    queryFn: ({ signal }) => deploymentsApi.compare(projectId, compareParams, signal),
    enabled: ready,
    placeholderData: keepPreviousData,
  }));

  const notFound = $derived(
    (isApiError(project.error) && project.error.isNotFound) ||
      (isApiError(environments.error) && environments.error.isNotFound),
  );

  function swap() {
    setQuery({ base: target.value || null, target: base.value || null });
  }
</script>

{#snippet commitLine(commit: CommitBrief)}
  <div class="flex min-w-0 items-center gap-2">
    <HashChip hash={commit.commit_hash} short={commit.short_hash} href={paths.commit(commit.id)} />
    <a
      href={paths.commit(commit.id)}
      class="text-foreground hover:text-brand min-w-0 flex-1 truncate text-sm"
      title={commitSubject(commit.commit_message)}
    >
      {commitSubject(commit.commit_message)}
    </a>
  </div>
{/snippet}

{#snippet sideCard(side: ComparisonSide, role: string)}
  <section class="bg-card flex min-w-0 flex-col gap-3 rounded-lg border p-4" aria-label="{role}: {side.environment.name}">
    <div class="flex items-center justify-between gap-2">
      <EnvironmentBadge
        name={side.environment.name}
        color={side.environment.color}
        href={paths.deployments({ project_id: projectId, environment_id: side.environment.id })}
      />
      <span class="text-muted-foreground tabular text-xs">
        {pluralize(side.recorded_commit_count, 'recorded commit')}
      </span>
    </div>
    {#if side.latest_deployment}
      {@const latest = side.latest_deployment}
      <div class="flex min-w-0 flex-col gap-1.5">
        <span class="eyebrow">Latest record</span>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <a href={paths.deployment(latest.id)} class="text-foreground hover:text-brand min-w-0 truncate text-sm font-medium">
            {latest.deployment_title}
          </a>
          <StatusBadge status={latest.status} variant="dot" />
        </div>
        {@render commitLine(latest.commit)}
        <DateTime value={latest.deployed_at} mode="both" class="text-muted-foreground text-xs" />
      </div>
    {:else}
      <p class="text-muted-foreground text-sm">No record with the statuses being counted.</p>
    {/if}
  </section>
{/snippet}

<div class="page">
  <PageHeader
    title="Compare environments"
    description="See which commits have a deployment record in one environment, the other, or both."
    breadcrumbs={[
      { label: 'Projects', href: paths.projects() },
      { label: project.data?.name ?? 'Project', href: paths.project(projectId) },
      { label: 'Compare' },
    ]}
  >
    {#snippet actions()}
      <Button variant="outline" href={paths.deployments({ project_id: projectId })}>Deployment history</Button>
    {/snippet}
  </PageHeader>

  {#if environments.isPending}
    <DetailSkeleton header={false} />
  {:else if environments.isError}
    <ErrorState
      error={environments.error}
      title={notFound ? 'Project not found' : 'The environments could not be loaded'}
      message={notFound ? 'It may have been deleted, or the link is wrong.' : undefined}
      onretry={notFound ? undefined : () => environments.refetch()}
      retrying={environments.isFetching}
    />
  {:else if environments.data.length < 2}
    <EmptyState
      icon={GitCompareIcon}
      title="Two environments are needed for a comparison"
      description={environments.data.length === 0
        ? 'This project has no environments yet. Add at least two, for example Staging and Production.'
        : `This project only has “${environments.data[0]?.name}”. Add another environment to compare their deployment records.`}
    >
      {#snippet action()}
        <Button href={paths.projectEnvironments(projectId)}>Manage environments</Button>
      {/snippet}
    </EmptyState>
  {:else}
    <section class="bg-card mb-6 rounded-lg border p-4" aria-label="Comparison settings">
      <div class="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div class="flex flex-col gap-1.5">
          <label for="{uid}-base" class="text-sm font-medium">First environment</label>
          <EnvironmentSelect
            id="{uid}-base"
            {projectId}
            value={base.value || null}
            onchange={(next) => setQuery({ base: next })}
            placeholder="Select an environment…"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Swap environments"
          title="Swap environments"
          onclick={swap}
          disabled={base.value === '' && target.value === ''}
          class="justify-self-center"
        >
          <ArrowLeftRightIcon aria-hidden="true" />
        </Button>
        <div class="flex flex-col gap-1.5">
          <label for="{uid}-target" class="text-sm font-medium">Second environment</label>
          <EnvironmentSelect
            id="{uid}-target"
            {projectId}
            value={target.value || null}
            onchange={(next) => setQuery({ target: next })}
            placeholder="Select an environment…"
          />
        </div>
      </div>
      <div class="mt-4 flex items-center gap-2.5 border-t pt-3">
        <Switch
          id="{uid}-all"
          checked={includeAll.value}
          onCheckedChange={(checked) => (includeAll.value = checked)}
        />
        <label for="{uid}-all" class="text-sm">Include failed, rolled-back and pending records</label>
      </div>
    </section>

    {#if base.value === '' || target.value === ''}
      <EmptyState
        icon={GitCompareIcon}
        title="Choose two environments"
        description="Select the two environments whose deployment records you want to see side by side."
      />
    {:else if base.value === target.value}
      <EmptyState
        icon={GitCompareIcon}
        title="Choose two different environments"
        description="Both selections point at the same environment. Change one of them to compare."
      />
    {:else if comparison.isPending}
      <DetailSkeleton header={false} />
    {:else if comparison.isError}
      <ErrorState error={comparison.error} onretry={() => comparison.refetch()} retrying={comparison.isFetching} />
    {:else}
      {@const result = comparison.data}
      {@const baseName = result.base.environment.name}
      {@const targetName = result.target.environment.name}

      <div
        role="note"
        aria-label="How to read this comparison"
        class="border-info/25 bg-info/10 text-foreground mb-6 flex items-start gap-2.5 rounded-lg border p-3 text-sm"
      >
        <InfoIcon class="text-info mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div class="flex flex-col gap-1">
          <p>{result.notice}</p>
          <p class="text-muted-foreground text-xs">
            Counting records with status:
            {result.statuses_considered.map((status) => STATUS_PRESENTATION[status].label).join(', ')}.
          </p>
        </div>
      </div>

      <div class="mb-6 grid gap-4 md:grid-cols-2">
        {@render sideCard(result.base, 'First environment')}
        {@render sideCard(result.target, 'Second environment')}
      </div>

      <div class="grid gap-6 xl:grid-cols-3">
        <section aria-labelledby="{uid}-only-base" class="min-w-0">
          <h2 id="{uid}-only-base" class="flex items-baseline justify-between gap-2 text-sm font-semibold">
            <span>Recorded in {baseName} only</span>
            <span class="text-muted-foreground tabular font-normal">{formatNumber(result.counts.only_in_base)}</span>
          </h2>
          <p class="text-muted-foreground mt-0.5 mb-3 text-xs">A record exists in {baseName}; no record in {targetName}.</p>
          {#if result.only_in_base.length === 0}
            <p class="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
              Every commit recorded in {baseName} also has a record in {targetName}.
            </p>
          {:else}
            <ul class="bg-card divide-y rounded-lg border" aria-label="Commits recorded in {baseName} only">
              {#each result.only_in_base as item (item.commit.id)}
                <li class="flex flex-col gap-1.5 px-3 py-2">
                  {@render commitLine(item.commit)}
                  <div class="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <BranchBadge name={item.commit.branch_name} />
                    <span>Last record <DateTime value={item.last_deployed_at} mode="date" /></span>
                    {#if item.deployment_count > 1}
                      <span class="tabular">{pluralize(item.deployment_count, 'record')}</span>
                    {/if}
                  </div>
                </li>
              {/each}
            </ul>
          {/if}
        </section>

        <section aria-labelledby="{uid}-only-target" class="min-w-0">
          <h2 id="{uid}-only-target" class="flex items-baseline justify-between gap-2 text-sm font-semibold">
            <span>Recorded in {targetName} only</span>
            <span class="text-muted-foreground tabular font-normal">{formatNumber(result.counts.only_in_target)}</span>
          </h2>
          <p class="text-muted-foreground mt-0.5 mb-3 text-xs">A record exists in {targetName}; no record in {baseName}.</p>
          {#if result.only_in_target.length === 0}
            <p class="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
              Every commit recorded in {targetName} also has a record in {baseName}.
            </p>
          {:else}
            <ul class="bg-card divide-y rounded-lg border" aria-label="Commits recorded in {targetName} only">
              {#each result.only_in_target as item (item.commit.id)}
                <li class="flex flex-col gap-1.5 px-3 py-2">
                  {@render commitLine(item.commit)}
                  <div class="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <BranchBadge name={item.commit.branch_name} />
                    <span>Last record <DateTime value={item.last_deployed_at} mode="date" /></span>
                    {#if item.deployment_count > 1}
                      <span class="tabular">{pluralize(item.deployment_count, 'record')}</span>
                    {/if}
                  </div>
                </li>
              {/each}
            </ul>
          {/if}
        </section>

        <section aria-labelledby="{uid}-both" class="min-w-0">
          <h2 id="{uid}-both" class="flex items-baseline justify-between gap-2 text-sm font-semibold">
            <span>Recorded in both</span>
            <span class="text-muted-foreground tabular font-normal">{formatNumber(result.counts.in_both)}</span>
          </h2>
          <p class="text-muted-foreground mt-0.5 mb-3 text-xs">A record exists in {baseName} and in {targetName}.</p>
          {#if result.in_both.length === 0}
            <p class="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
              No commit has a record in both environments.
            </p>
          {:else}
            <ul class="bg-card divide-y rounded-lg border" aria-label="Commits recorded in both environments">
              {#each result.in_both as item (item.commit.id)}
                <li class="flex flex-col gap-1.5 px-3 py-2">
                  {@render commitLine(item.commit)}
                  <div class="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span>{baseName} <DateTime value={item.base_last_deployed_at} mode="date" /></span>
                    <span>{targetName} <DateTime value={item.target_last_deployed_at} mode="date" /></span>
                  </div>
                </li>
              {/each}
            </ul>
          {/if}
        </section>
      </div>

      {#if result.truncated}
        <p class="text-muted-foreground mt-4 text-sm">
          The lists show the most recently deployed commits only. The counts above cover every record.
        </p>
      {/if}
    {/if}
  {/if}
</div>
