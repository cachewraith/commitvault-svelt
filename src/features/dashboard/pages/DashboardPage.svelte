<!--
  Workspace overview. Every number and list comes from `GET /dashboard`
  (live records) — nothing here is hard-coded or sampled.
-->
<script lang="ts">
  import type { Component } from 'svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import FolderGitIcon from '@lucide/svelte/icons/folder-git-2';
  import GitCommitIcon from '@lucide/svelte/icons/git-commit-horizontal';
  import NotebookIcon from '@lucide/svelte/icons/notebook-text';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import RocketIcon from '@lucide/svelte/icons/rocket';
  import ServerIcon from '@lucide/svelte/icons/server';
  import { queryKeys } from '$lib/api';
  import {
    CardGridSkeleton,
    DateTime,
    EmptyState,
    EnvironmentBadge,
    ErrorState,
    HashChip,
    ListSkeleton,
    PageHeader,
    StatusBadge,
  } from '$lib/components';
  import { Button } from '$lib/components/ui/button';
  import { navigate } from '$lib/router';
  import { formatNumber } from '$lib/utils';
  import { paths } from '$routes/paths';
  import CommitList from '$features/commits/components/CommitList.svelte';
  import DeploymentTimeline from '$features/deployments/components/DeploymentTimeline.svelte';
  import NoteList from '$features/notes/components/NoteList.svelte';
  import ProjectFormDialog from '$features/projects/components/ProjectFormDialog.svelte';
  import { dashboardApi } from '../api';
  import DeploymentActivityChart from '../components/DeploymentActivityChart.svelte';

  const dashboard = createQuery(() => ({
    queryKey: queryKeys.dashboard.summary(),
    queryFn: ({ signal }) => dashboardApi.get(signal),
  }));
  const data = $derived(dashboard.data);

  const isFirstRun = $derived(
    data !== undefined && Object.values(data.totals).every((count) => count === 0),
  );

  let creatingProject = $state(false);

  interface Tile {
    label: string;
    value: number;
    href: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icon: Component<any>;
    detail?: string;
  }

  const tiles = $derived<Tile[]>(
    data
      ? [
          {
            label: 'Projects',
            value: data.totals.projects,
            href: paths.projects(),
            icon: FolderGitIcon,
            detail: `${formatNumber(data.totals.active_projects)} active`,
          },
          {
            label: 'Commits',
            value: data.totals.commits,
            href: paths.commits(),
            icon: GitCommitIcon,
            detail: 'recorded',
          },
          {
            label: 'Environments',
            value: data.totals.environments,
            href: paths.environments(),
            icon: ServerIcon,
            detail: 'across all projects',
          },
          {
            label: 'Deployments',
            value: data.totals.deployments,
            href: paths.deployments(),
            icon: RocketIcon,
            detail: 'recorded events',
          },
        ]
      : [],
  );

  const secondary = $derived(
    data
      ? [
          { label: 'Releases', value: data.totals.releases, href: paths.releases() },
          { label: 'Notes', value: data.totals.notes, href: paths.notes() },
          { label: 'Tags', value: data.totals.tags, href: paths.tags() },
        ]
      : [],
  );
</script>

{#snippet sectionHeader(id: string, title: string, href: string, linkLabel: string)}
  <div class="mb-2 flex items-center justify-between gap-2">
    <h2 {id} class="text-sm font-semibold">{title}</h2>
    <a {href} class="text-brand text-sm hover:underline">{linkLabel}</a>
  </div>
{/snippet}

<div class="page">
  <PageHeader title="Dashboard" description="What was recorded recently across your projects." />

  {#if dashboard.isPending}
    <CardGridSkeleton count={4} variant="stat" class="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" />
    <div class="grid gap-6 lg:grid-cols-2">
      <ListSkeleton rows={6} />
      <ListSkeleton rows={6} />
    </div>
  {:else if dashboard.isError}
    <ErrorState error={dashboard.error} onretry={() => dashboard.refetch()} retrying={dashboard.isFetching} />
  {:else if data && isFirstRun}
    <EmptyState
      icon={FolderGitIcon}
      title="Welcome to CommitVault"
      description="Start by creating a project. Then add its environments, record commits, and note each deployment — CommitVault keeps the history so you do not have to remember it."
    >
      {#snippet action()}
        <div class="flex flex-wrap justify-center gap-2">
          <Button onclick={() => (creatingProject = true)}>
            <PlusIcon aria-hidden="true" />
            Create your first project
          </Button>
          <Button variant="outline" href={paths.noteNew()}>Write a note</Button>
        </div>
      {/snippet}
    </EmptyState>
  {:else if data}
    <section aria-label="Totals" class="mb-6">
      <ul class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {#each tiles as tile (tile.label)}
          <li>
            <a
              href={tile.href}
              class="bg-card hover:border-brand/40 flex h-full flex-col rounded-lg border p-4 transition-colors"
            >
              <span class="text-muted-foreground flex items-center justify-between text-sm">
                {tile.label}
                <tile.icon class="size-4" aria-hidden="true" />
              </span>
              <span class="tabular mt-2 text-2xl font-semibold tracking-tight">{formatNumber(tile.value)}</span>
              {#if tile.detail}
                <span class="text-muted-foreground tabular mt-0.5 text-xs">{tile.detail}</span>
              {/if}
            </a>
          </li>
        {/each}
      </ul>
      <ul class="text-muted-foreground mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {#each secondary as item (item.label)}
          <li>
            <a href={item.href} class="hover:text-foreground">
              <span class="text-foreground tabular font-medium">{formatNumber(item.value)}</span>
              {item.label.toLowerCase()}
            </a>
          </li>
        {/each}
      </ul>
    </section>

    <div class="grid gap-6 lg:grid-cols-2">
      <section aria-labelledby="dash-deployments" class="bg-card rounded-lg border p-4">
        {@render sectionHeader('dash-deployments', 'Recent deployments', paths.deployments(), 'All deployments')}
        {#if data.recent_deployments.length === 0}
          <EmptyState
            compact
            bordered={false}
            icon={RocketIcon}
            title="No deployments recorded"
            description="Record a deployment from a project or a commit to build the history."
          />
        {:else}
          <DeploymentTimeline deployments={data.recent_deployments} showProject label="Recent deployments" />
        {/if}
      </section>

      <section aria-labelledby="dash-commits" class="bg-card rounded-lg border p-4">
        {@render sectionHeader('dash-commits', 'Recent commits', paths.commits(), 'All commits')}
        {#if data.recent_commits.length === 0}
          <EmptyState
            compact
            bordered={false}
            icon={GitCommitIcon}
            title="No commits recorded"
            description="Commits are added by hand — open a project to record one."
          />
        {:else}
          <CommitList commits={data.recent_commits} showProject label="Recent commits" />
        {/if}
      </section>

      <section aria-labelledby="dash-activity" class="bg-card rounded-lg border p-4 lg:col-span-2">
        <h2 id="dash-activity" class="mb-2 text-sm font-semibold">Deployment activity, last 30 days</h2>
        <DeploymentActivityChart days={data.deployment_activity} />
      </section>

      <section aria-labelledby="dash-environments" class="bg-card rounded-lg border p-4">
        {@render sectionHeader('dash-environments', 'Environment overview', paths.environments(), 'All environments')}
        {#if data.environment_overview.length === 0}
          <EmptyState
            compact
            bordered={false}
            icon={ServerIcon}
            title="No environments yet"
            description="Add environments such as staging or production to a project."
          />
        {:else}
          <p class="text-muted-foreground mb-2 text-xs">Latest recorded deployment per environment.</p>
          <ul class="divide-y" aria-label="Environments">
            {#each data.environment_overview as environment (environment.id)}
              {@const latest = environment.latest_deployment}
              <li class="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                <span class="flex min-w-0 flex-1 basis-48 items-center gap-2">
                  <EnvironmentBadge
                    name={environment.name}
                    color={environment.color}
                    href={paths.deployments({ environment_id: environment.id, project_id: environment.project_id })}
                  />
                  <a
                    href={paths.project(environment.project.id)}
                    class="text-muted-foreground hover:text-foreground truncate text-xs"
                  >
                    {environment.project.name}
                  </a>
                </span>
                {#if latest}
                  <StatusBadge status={latest.status} variant="dot" />
                  <HashChip
                    hash={latest.commit.commit_hash}
                    short={latest.commit.short_hash}
                    href={paths.commit(latest.commit.id)}
                    copyable={false}
                  />
                  <a href={paths.deployment(latest.id)} class="text-muted-foreground hover:text-foreground text-xs">
                    <DateTime value={latest.deployed_at} class="tabular" />
                  </a>
                {:else}
                  <span class="text-muted-foreground text-xs">No deployment recorded</span>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <section aria-labelledby="dash-projects" class="bg-card rounded-lg border p-4">
        {@render sectionHeader('dash-projects', 'Project activity', paths.projects(), 'All projects')}
        {#if data.project_activity.length === 0}
          <EmptyState
            compact
            bordered={false}
            icon={FolderGitIcon}
            title="No active projects"
            description="Archived projects are not listed here."
          />
        {:else}
          <ul class="divide-y" aria-label="Projects by latest activity">
            {#each data.project_activity as activity (activity.project.id)}
              <li class="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                <a
                  href={paths.project(activity.project.id)}
                  class="text-foreground min-w-0 flex-1 basis-40 truncate font-medium hover:underline"
                >
                  {activity.project.name}
                </a>
                <span class="text-muted-foreground tabular text-xs">
                  {formatNumber(activity.commit_count)} commits · {formatNumber(activity.deployment_count)} deployments
                </span>
                <DateTime value={activity.last_activity_at} class="text-muted-foreground tabular w-24 text-right text-xs" />
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <section aria-labelledby="dash-notes" class="bg-card rounded-lg border p-4 lg:col-span-2">
        {@render sectionHeader('dash-notes', 'Recently updated notes', paths.notes(), 'All notes')}
        {#if data.recent_notes.length === 0}
          <EmptyState
            compact
            bordered={false}
            icon={NotebookIcon}
            title="No notes yet"
            description="Keep runbooks, decisions and commands next to the history they belong to."
          >
            {#snippet action()}
              <Button variant="outline" href={paths.noteNew()}>New note</Button>
            {/snippet}
          </EmptyState>
        {:else}
          <NoteList notes={data.recent_notes} showProject label="Recently updated notes" />
        {/if}
      </section>
    </div>
  {/if}
</div>

<ProjectFormDialog bind:open={creatingProject} onsaved={(project) => navigate(paths.project(project.id))} />
