<!--
  Project overview, kept to what is checked most: stats, environments with
  their latest recorded deployment and recent deployment records; branches,
  releases and notes in a narrow side column. Full lists are one click away
  (stats and "View all"); rarer actions sit in the header's "More" menu.
-->
<script lang="ts">
  import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
  import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
  import GitBranchIcon from '@lucide/svelte/icons/git-branch';
  import GitCommitIcon from '@lucide/svelte/icons/git-commit-horizontal';
  import GitCompareIcon from '@lucide/svelte/icons/git-compare-arrows';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import RocketIcon from '@lucide/svelte/icons/rocket';
  import ServerIcon from '@lucide/svelte/icons/server';
  import SettingsIcon from '@lucide/svelte/icons/settings';
  import { isApiError, queryKeys } from '$lib/api';
  import {
    BranchBadge,
    DateTime,
    DetailSkeleton,
    EmptyState,
    EnvironmentBadge,
    ErrorState,
    ListSkeleton,
    PageHeader,
    StatusBadge,
    TagBadge,
    toast,
    toastError,
  } from '$lib/components';
  import { Button } from '$lib/components/ui/button';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import { navigate, setPageTitle } from '$lib/router';
  import { cn, formatNumber, pluralize, safeExternalUrl } from '$lib/utils';
  import { paths } from '$routes/paths';
  import { branchesApi } from '$features/branches/api';
  import CommitFormDialog from '$features/commits/components/CommitFormDialog.svelte';
  import { deploymentsApi } from '$features/deployments/api';
  import DeploymentFormDialog from '$features/deployments/components/DeploymentFormDialog.svelte';
  import DeploymentTimeline from '$features/deployments/components/DeploymentTimeline.svelte';
  import { environmentsApi } from '$features/environments/api';
  import LatestDeployment from '$features/environments/components/LatestDeployment.svelte';
  import { notesApi } from '$features/notes/api';
  import NoteList from '$features/notes/components/NoteList.svelte';
  import { releasesApi } from '$features/releases/api';
  import ReleaseFormDialog from '$features/releases/components/ReleaseFormDialog.svelte';
  import ReleaseList from '$features/releases/components/ReleaseList.svelte';
  import { projectsApi } from '../api';
  import Section from './Section.svelte';
  import { invalidateAllProjectData } from '../queries';

  interface Props {
    projectId: string;
    /** `page`: full screen with breadcrumbs; `panel`: single column in the side panel. */
    layout?: 'page' | 'panel';
  }

  let { projectId, layout = 'page' }: Props = $props();
  const isPage = $derived(layout === 'page');

  const queryClient = useQueryClient();

  const RECENT = 8;
  const SIDE = 4;
  const scope = $derived({ project_id: projectId });
  const recentParams = $derived({ project_id: projectId, per_page: RECENT });
  const sideParams = $derived({ project_id: projectId, per_page: SIDE });

  const project = createQuery(() => ({
    queryKey: queryKeys.projects.detail(projectId),
    queryFn: ({ signal }) => projectsApi.get(projectId, signal),
  }));


  const environments = createQuery(() => ({
    queryKey: queryKeys.environments.byProject(projectId),
    queryFn: ({ signal }) => environmentsApi.listForProject(projectId, signal),
  }));
  const deployments = createQuery(() => ({
    queryKey: queryKeys.deployments.list(recentParams),
    queryFn: ({ signal }) => deploymentsApi.list(recentParams, signal),
  }));
  const branchParams = { per_page: SIDE };
  const branches = createQuery(() => ({
    queryKey: queryKeys.branches.list({ projectId, ...branchParams }),
    queryFn: ({ signal }) => branchesApi.list(projectId, branchParams, signal),
  }));
  const releases = createQuery(() => ({
    queryKey: queryKeys.releases.list(sideParams),
    queryFn: ({ signal }) => releasesApi.list(sideParams, signal),
  }));
  const notes = createQuery(() => ({
    queryKey: queryKeys.notes.list(sideParams),
    queryFn: ({ signal }) => notesApi.list(sideParams, signal),
  }));

  $effect(() => {
    if (isPage && project.data) setPageTitle(project.data.name);
  });

  let commitOpen = $state(false);
  let deploymentOpen = $state(false);
  let releaseOpen = $state(false);

  const restore = createMutation(() => ({
    mutationFn: () => projectsApi.update(projectId, { status: 'active' }),
    onSuccess: (restored) => {
      invalidateAllProjectData(queryClient);
      toast.success(`“${restored.name}” restored`);
    },
    onError: (error) => toastError(error, 'Could not restore the project.'),
  }));
</script>

<div>
  {#if project.isPending}
    <DetailSkeleton />
  {:else if project.isError}
    {#if isPage}
      <PageHeader title="Project" breadcrumbs={[{ label: 'Projects', href: paths.projects() }, { label: 'Project' }]} />
    {/if}
    <ErrorState
      error={project.error}
      title={isApiError(project.error) && project.error.isNotFound ? 'Project not found' : undefined}
      onretry={() => project.refetch()}
      retrying={project.isFetching}
    />
  {:else}
    {@const current = project.data}
    {@const repositoryUrl = safeExternalUrl(current.repository_url)}
    {@const stats = current.stats}

    {#snippet metaLine()}
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
      {#if current.status === 'archived'}
        <StatusBadge status="archived" />
      {/if}
      <span class="text-muted-foreground font-mono text-xs">{current.slug}</span>
      <BranchBadge name={current.default_branch} href={paths.projectBranches(projectId)} />
      {#if repositoryUrl}
        <a
          href={repositoryUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="text-brand inline-flex max-w-[40ch] items-center gap-1 hover:underline"
        >
          <span class="truncate">{repositoryUrl.replace(/^https?:\/\//, '')}</span>
          <ExternalLinkIcon class="size-3.5 shrink-0" aria-hidden="true" />
          <span class="sr-only">(opens in a new tab)</span>
        </a>
      {/if}
      {#each current.tags as tag (tag.id)}
        <TagBadge name={tag.name} color={tag.color} href={paths.projects({ tag_id: tag.id })} />
      {/each}
      <span class="text-muted-foreground text-xs">
        Last deployment recorded <DateTime value={stats.last_deployed_at} fallback="never" />
      </span>
    </div>
    {/snippet}
    {#snippet actionButtons(compact: boolean)}
    <Button variant="outline" size={compact ? 'sm' : 'default'} onclick={() => (commitOpen = true)}>
      <GitCommitIcon aria-hidden="true" />
      Record commit
    </Button>
    <Button size={compact ? 'sm' : 'default'} onclick={() => (deploymentOpen = true)}>
      <RocketIcon aria-hidden="true" />
      Record deployment
    </Button>
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button {...props} variant="outline" size={compact ? 'icon-sm' : 'icon'} aria-label="More project actions">
            <EllipsisIcon aria-hidden="true" />
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" class="w-56">
        <DropdownMenu.Item onSelect={() => navigate(paths.projectCompare(projectId))}>
          <GitCompareIcon aria-hidden="true" />
          Compare environments
        </DropdownMenu.Item>
        <DropdownMenu.Item onSelect={() => navigate(paths.projectBranches(projectId))}>
          <GitBranchIcon aria-hidden="true" />
          Branches
        </DropdownMenu.Item>
        <DropdownMenu.Item onSelect={() => navigate(paths.projectEnvironments(projectId))}>
          <ServerIcon aria-hidden="true" />
          Environments
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item onSelect={() => navigate(paths.projectSettings(projectId))}>
          <SettingsIcon aria-hidden="true" />
          Project settings
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
    {/snippet}

    {#if isPage}
      <PageHeader
        title={current.name}
        breadcrumbs={[{ label: 'Projects', href: paths.projects() }, { label: current.name }]}
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
        <h2 class="text-foreground text-lg font-semibold break-words">{current.name}</h2>
        {@render metaLine()}
        <div class="flex flex-wrap gap-2">{@render actionButtons(true)}</div>
      </header>
    {/if}

    {#if current.status === 'archived'}
      <div
        class="border-warning/25 bg-warning/10 mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm"
        role="status"
      >
        <p>
          This project was archived <DateTime value={current.archived_at} />. It is hidden from the dashboard and
          from pickers; its records are kept.
        </p>
        <Button variant="outline" size="sm" onclick={() => restore.mutate()} disabled={restore.isPending}>
          Restore project
        </Button>
      </div>
    {/if}

    {#if current.description}
      <p class="text-muted-foreground mb-6 max-w-3xl text-sm whitespace-pre-line">{current.description}</p>
    {/if}

    <dl class="bg-card mb-6 grid grid-cols-2 divide-x divide-y rounded-lg border sm:grid-cols-5 sm:divide-y-0">
      {#each [
        { label: 'Commits', value: stats.commit_count, href: paths.commits(scope) },
        { label: 'Environments', value: stats.environment_count, href: paths.projectEnvironments(projectId) },
        { label: 'Deployment records', value: stats.deployment_count, href: paths.deployments(scope) },
        { label: 'Releases', value: stats.release_count, href: paths.releases(scope) },
        { label: 'Notes', value: stats.note_count, href: paths.notes(scope) },
      ] as stat (stat.label)}
        <div class="px-4 py-3">
          <dt class="eyebrow">{stat.label}</dt>
          <dd class="mt-1">
            <a href={stat.href} class="tabular text-xl font-semibold hover:underline">{formatNumber(stat.value)}</a>
          </dd>
        </div>
      {/each}
    </dl>

    <div class={cn('grid gap-6', isPage && 'lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]')}>
      <div class="flex min-w-0 flex-col gap-6">
        <Section
          title="Environments"
          count={stats.environment_count}
          href={paths.projectEnvironments(projectId)}
          viewAllLabel="Manage"
        >
          {#if environments.isPending}
            <ListSkeleton rows={3} />
          {:else if environments.isError}
            <ErrorState error={environments.error} onretry={() => environments.refetch()} compact />
          {:else if environments.data.length === 0}
            <EmptyState
              compact
              title="No environments yet"
              description="Add the places this project is deployed to, so deployments can be recorded against them."
            >
              {#snippet action()}
                <Button variant="outline" size="sm" href={paths.projectEnvironments(projectId)}>
                  <PlusIcon aria-hidden="true" />
                  Add environment
                </Button>
              {/snippet}
            </EmptyState>
          {:else}
            <ul class="bg-card divide-y rounded-lg border" aria-label="Environments and their latest recorded deployment">
              {#each environments.data as environment (environment.id)}
                <li class="flex flex-col gap-x-4 gap-y-2 px-4 py-2.5 sm:flex-row sm:items-center">
                  <div class="flex items-center gap-2 sm:w-56 sm:shrink-0">
                    <EnvironmentBadge
                      name={environment.name}
                      color={environment.color}
                      href={paths.deployments({ project_id: projectId, environment_id: environment.id })}
                    />
                    {#if environment.server_label}
                      <span class="text-muted-foreground truncate font-mono text-xs">{environment.server_label}</span>
                    {/if}
                  </div>
                  <LatestDeployment deployment={environment.latest_deployment} showMessage class="min-w-0 flex-1" />
                  <span class="text-muted-foreground tabular shrink-0 text-xs">
                    {pluralize(environment.deployment_count, 'record')}
                  </span>
                </li>
              {/each}
            </ul>
          {/if}
        </Section>

        <Section title="Recent deployments" count={stats.deployment_count} href={paths.deployments(scope)}>
          {#snippet actions()}
            <Button variant="ghost" size="sm" onclick={() => (deploymentOpen = true)}>
              <PlusIcon aria-hidden="true" />
              Record
            </Button>
          {/snippet}
          {#if deployments.isPending}
            <ListSkeleton rows={4} />
          {:else if deployments.isError}
            <ErrorState error={deployments.error} onretry={() => deployments.refetch()} compact />
          {:else if deployments.data.data.length === 0}
            <EmptyState
              compact
              title="No deployments recorded"
              description="Record one when you ship a commit to an environment."
            >
              {#snippet action()}
                <Button variant="outline" size="sm" onclick={() => (deploymentOpen = true)}>Record deployment</Button>
              {/snippet}
            </EmptyState>
          {:else}
            <DeploymentTimeline deployments={deployments.data.data} label="Recent deployment records" />
          {/if}
        </Section>
      </div>

      <div class="flex min-w-0 flex-col gap-6">
        <Section title="Branches" count={branches.data?.meta.total} href={paths.projectBranches(projectId)}>
          {#if branches.isPending}
            <ListSkeleton rows={3} />
          {:else if branches.isError}
            <ErrorState error={branches.error} onretry={() => branches.refetch()} compact />
          {:else if branches.data.data.length === 0}
            <EmptyState compact title="No branches yet" description="Branches appear here once you create one.">
              {#snippet action()}
                <Button variant="outline" size="sm" href={paths.projectBranches(projectId)}>Manage branches</Button>
              {/snippet}
            </EmptyState>
          {:else}
            <ul class="bg-card divide-y rounded-lg border" aria-label="Branches with the most recent commits">
              {#each branches.data.data as branch (branch.id)}
                <li class="flex items-center gap-2 px-4 py-2 text-sm">
                  <GitBranchIcon class="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
                  <a href={paths.branch(branch.id)} class="hover:text-brand min-w-0 flex-1 truncate font-mono text-xs">
                    {branch.name}
                  </a>
                  <span class="text-muted-foreground tabular shrink-0 text-xs">
                    {pluralize(branch.commit_count, 'commit')}
                  </span>
                </li>
              {/each}
            </ul>
          {/if}
        </Section>

        <Section title="Releases" count={stats.release_count} href={paths.releases(scope)}>
          {#snippet actions()}
            <Button variant="ghost" size="sm" onclick={() => (releaseOpen = true)}>
              <PlusIcon aria-hidden="true" />
              New
            </Button>
          {/snippet}
          {#if releases.isPending}
            <ListSkeleton rows={3} />
          {:else if releases.isError}
            <ErrorState error={releases.error} onretry={() => releases.refetch()} compact />
          {:else if releases.data.data.length === 0}
            <EmptyState compact title="No releases yet" description="Group commits into a versioned release with notes.">
              {#snippet action()}
                <Button variant="outline" size="sm" onclick={() => (releaseOpen = true)}>New release</Button>
              {/snippet}
            </EmptyState>
          {:else}
            <div class="bg-card rounded-lg border px-4 py-1">
              <ReleaseList releases={releases.data.data} label="Latest releases" />
            </div>
          {/if}
        </Section>

        <Section title="Notes" count={stats.note_count} href={paths.notes(scope)}>
          {#snippet actions()}
            <Button variant="ghost" size="sm" href={paths.noteNew(scope)}>
              <PlusIcon aria-hidden="true" />
              New
            </Button>
          {/snippet}
          {#if notes.isPending}
            <ListSkeleton rows={3} />
          {:else if notes.isError}
            <ErrorState error={notes.error} onretry={() => notes.refetch()} compact />
          {:else if notes.data.data.length === 0}
            <EmptyState
              compact
              title="No notes yet"
              description="Keep decisions, commands and migration steps next to the project."
            >
              {#snippet action()}
                <Button variant="outline" size="sm" href={paths.noteNew(scope)}>New note</Button>
              {/snippet}
            </EmptyState>
          {:else}
            <div class="bg-card rounded-lg border px-4 py-1">
              <NoteList notes={notes.data.data} label="Recently edited notes" />
            </div>
          {/if}
        </Section>
      </div>
    </div>

    <CommitFormDialog bind:open={commitOpen} {projectId} />
    <DeploymentFormDialog bind:open={deploymentOpen} {projectId} />
    <ReleaseFormDialog bind:open={releaseOpen} {projectId} />
  {/if}
</div>
