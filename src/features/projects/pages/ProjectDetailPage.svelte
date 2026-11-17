<!--
  Project overview: header, stats, environments with their latest recorded
  deployment, and recent deployments, commits, releases and notes.
-->
<script lang="ts">
  import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
  import GitCommitIcon from '@lucide/svelte/icons/git-commit-horizontal';
  import GitCompareIcon from '@lucide/svelte/icons/git-compare-arrows';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import RocketIcon from '@lucide/svelte/icons/rocket';
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
  import { setPageTitle } from '$lib/router';
  import { formatNumber, pluralize, safeExternalUrl } from '$lib/utils';
  import { paths } from '$routes/paths';
  import { commitsApi } from '$features/commits/api';
  import CommitFormDialog from '$features/commits/components/CommitFormDialog.svelte';
  import CommitList from '$features/commits/components/CommitList.svelte';
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
  import Section from '../components/Section.svelte';
  import { invalidateAllProjectData } from '../queries';

  let { projectId }: { projectId: string } = $props();

  const queryClient = useQueryClient();

  const RECENT = 8;
  const SIDE = 5;
  const scope = $derived({ project_id: projectId });
  const recentParams = $derived({ project_id: projectId, per_page: RECENT });
  const sideParams = $derived({ project_id: projectId, per_page: SIDE });

  const project = createQuery(() => ({
    queryKey: queryKeys.projects.detail(projectId),
    queryFn: ({ signal }) => projectsApi.get(projectId, signal),
  }));
  const loaded = $derived(project.isSuccess);

  const environments = createQuery(() => ({
    queryKey: queryKeys.environments.byProject(projectId),
    queryFn: ({ signal }) => environmentsApi.listForProject(projectId, signal),
    enabled: loaded,
  }));
  const deployments = createQuery(() => ({
    queryKey: queryKeys.deployments.list(recentParams),
    queryFn: ({ signal }) => deploymentsApi.list(recentParams, signal),
    enabled: loaded,
  }));
  const commits = createQuery(() => ({
    queryKey: queryKeys.commits.list(recentParams),
    queryFn: ({ signal }) => commitsApi.list(recentParams, signal),
    enabled: loaded,
  }));
  const releases = createQuery(() => ({
    queryKey: queryKeys.releases.list(sideParams),
    queryFn: ({ signal }) => releasesApi.list(sideParams, signal),
    enabled: loaded,
  }));
  const notes = createQuery(() => ({
    queryKey: queryKeys.notes.list(sideParams),
    queryFn: ({ signal }) => notesApi.list(sideParams, signal),
    enabled: loaded,
  }));

  $effect(() => {
    if (project.data) setPageTitle(project.data.name);
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

<div class="page">
  {#if project.isPending}
    <DetailSkeleton />
  {:else if project.isError}
    <PageHeader title="Project" breadcrumbs={[{ label: 'Projects', href: paths.projects() }, { label: 'Project' }]} />
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

    <PageHeader
      title={current.name}
      breadcrumbs={[{ label: 'Projects', href: paths.projects() }, { label: current.name }]}
    >
      {#snippet meta()}
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
          {#if current.status === 'archived'}
            <StatusBadge status="archived" />
          {/if}
          <span class="text-muted-foreground font-mono text-xs">{current.slug}</span>
          <BranchBadge name={current.default_branch} />
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
        </div>
      {/snippet}
      {#snippet actions()}
        <Button variant="outline" onclick={() => (commitOpen = true)}>
          <GitCommitIcon aria-hidden="true" />
          Record commit
        </Button>
        <Button onclick={() => (deploymentOpen = true)}>
          <RocketIcon aria-hidden="true" />
          Record deployment
        </Button>
        <Button variant="outline" href={paths.projectCompare(projectId)}>
          <GitCompareIcon aria-hidden="true" />
          Compare environments
        </Button>
        <Button variant="outline" size="icon" href={paths.projectSettings(projectId)} aria-label="Project settings">
          <SettingsIcon aria-hidden="true" />
        </Button>
      {/snippet}
    </PageHeader>

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

    <div class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
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
                  <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span class="eyebrow">Latest recorded deployment</span>
                    <LatestDeployment deployment={environment.latest_deployment} showMessage />
                  </div>
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
              description="Record a deployment when you ship a commit to an environment. Nothing is deployed by CommitVault itself."
            >
              {#snippet action()}
                <Button variant="outline" size="sm" onclick={() => (deploymentOpen = true)}>Record deployment</Button>
              {/snippet}
            </EmptyState>
          {:else}
            <DeploymentTimeline deployments={deployments.data.data} label="Recent deployment records" />
          {/if}
        </Section>

        <Section title="Recent commits" count={stats.commit_count} href={paths.commits(scope)}>
          {#snippet actions()}
            <Button variant="ghost" size="sm" onclick={() => (commitOpen = true)}>
              <PlusIcon aria-hidden="true" />
              Record
            </Button>
          {/snippet}
          {#if commits.isPending}
            <ListSkeleton rows={4} />
          {:else if commits.isError}
            <ErrorState error={commits.error} onretry={() => commits.refetch()} compact />
          {:else if commits.data.data.length === 0}
            <EmptyState
              compact
              title="No commits recorded"
              description="Register the commits you want to remember: branch, hash and message."
            >
              {#snippet action()}
                <Button variant="outline" size="sm" onclick={() => (commitOpen = true)}>Record commit</Button>
              {/snippet}
            </EmptyState>
          {:else}
            <CommitList commits={commits.data.data} label="Recent commits" />
          {/if}
        </Section>
      </div>

      <div class="flex min-w-0 flex-col gap-6">
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

        <Section title="Details">
          <dl class="bg-card grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg border px-4 py-3 text-sm">
            <dt class="text-muted-foreground">Created</dt>
            <dd class="tabular"><DateTime value={current.created_at} mode="date" /></dd>
            <dt class="text-muted-foreground">Updated</dt>
            <dd class="tabular"><DateTime value={current.updated_at} /></dd>
            <dt class="text-muted-foreground">Last recorded deployment</dt>
            <dd class="tabular"><DateTime value={stats.last_deployed_at} fallback="None recorded" /></dd>
          </dl>
        </Section>
      </div>
    </div>

    <CommitFormDialog bind:open={commitOpen} {projectId} />
    <DeploymentFormDialog bind:open={deploymentOpen} {projectId} />
    <ReleaseFormDialog bind:open={releaseOpen} {projectId} />
  {/if}
</div>
