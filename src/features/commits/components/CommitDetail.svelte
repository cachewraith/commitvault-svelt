<!--
  One recorded commit: its details, where deployments of it were recorded,
  the full deployment history and the releases that include it. Rendered as
  a full page (`layout="page"`, with breadcrumbs) or inside the slide-in
  panel of a list (`layout="panel"`, single column).
-->
<script lang="ts">
  import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import RocketIcon from '@lucide/svelte/icons/rocket';
  import TrashIcon from '@lucide/svelte/icons/trash';
  import { isApiError, queryKeys } from '$lib/api';
  import {
    BranchBadge,
    CopyButton,
    DateTime,
    DetailSkeleton,
    EmptyState,
    EnvironmentBadge,
    ErrorState,
    ListSkeleton,
    PageHeader,
    StatusBadge,
    TagBadge,
    confirm,
    toast,
    toastError,
  } from '$lib/components';
  import { Button } from '$lib/components/ui/button';
  import { navigate, setPageTitle } from '$lib/router';
  import { cn } from '$lib/utils/cn';
  import { pluralize } from '$lib/utils/format';
  import { safeExternalUrl } from '$lib/utils/url';
  import { deploymentsApi } from '$features/deployments/api';
  import DeploymentFormDialog from '$features/deployments/components/DeploymentFormDialog.svelte';
  import DeploymentTimeline from '$features/deployments/components/DeploymentTimeline.svelte';
  import { paths } from '$routes/paths';
  import { commitsApi } from '../api';
  import { commitBody, commitSubject } from '../format';
  import CommitFormDialog from './CommitFormDialog.svelte';

  interface Props {
    commitId: string;
    layout?: 'page' | 'panel';
    /** After a successful delete. Default: go to the commit list. */
    ondeleted?: () => void;
  }

  let { commitId, layout = 'page', ondeleted }: Props = $props();
  const isPage = $derived(layout === 'page');

  const queryClient = useQueryClient();
  const HISTORY_LIMIT = 50;

  const commit = createQuery(() => ({
    queryKey: queryKeys.commits.detail(commitId),
    queryFn: ({ signal }) => commitsApi.get(commitId, signal),
  }));

  const historyParams = $derived({ commit_id: commitId, per_page: HISTORY_LIMIT });
  const history = createQuery(() => ({
    queryKey: queryKeys.deployments.list(historyParams),
    queryFn: ({ signal }) => deploymentsApi.list(historyParams, signal),
  }));

  $effect(() => {
    if (isPage && commit.data) setPageTitle(`${commit.data.short_hash} ${commitSubject(commit.data.commit_message)}`);
  });

  const notFound = $derived(isApiError(commit.error) && commit.error.isNotFound);

  let editOpen = $state(false);
  let deployOpen = $state(false);

  const removeCommit = createMutation(() => ({
    mutationFn: (cascade: boolean) => commitsApi.remove(commitId, { cascade }),
    onSuccess: () => {
      // Drop this commit's own queries first so nothing refetches a deleted record.
      queryClient.removeQueries({ queryKey: queryKeys.commits.detail(commitId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.commits.lists() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.deployments.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.environments.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.releases.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      toast.success('Commit deleted');
      if (ondeleted) ondeleted();
      else navigate(paths.commits(), { replace: true });
    },
    onError: (error) => toastError(error, 'Could not delete the commit.'),
  }));

  async function remove() {
    const current = commit.data;
    if (!current) return;
    const records = current.deployment_count;
    const ok = await confirm(
      records === 0
        ? {
            title: `Delete commit ${current.short_hash}?`,
            description:
              'The commit is removed from CommitVault together with its tags and release associations. Nothing changes in your repository.',
            confirmLabel: 'Delete commit',
            destructive: true,
          }
        : {
            title: `Delete commit ${current.short_hash} and its deployment history?`,
            description: `Also delete ${pluralize(records, 'deployment record')} of this commit. This removes part of your deployment history and cannot be undone.`,
            confirmLabel: `Delete commit and ${pluralize(records, 'record')}`,
            destructive: true,
          },
    );
    // Deployment history is only removed when the user explicitly agreed to it.
    if (ok) removeCommit.mutate(records > 0);
  }
</script>

{#snippet actionButtons(compact: boolean)}
  <Button size={compact ? 'sm' : 'default'} onclick={() => (deployOpen = true)}>
    <RocketIcon aria-hidden="true" />
    Record deployment
  </Button>
  <Button size={compact ? 'sm' : 'default'} variant="outline" onclick={() => (editOpen = true)}>
    <PencilIcon aria-hidden="true" />
    Edit
  </Button>
  <Button size={compact ? 'sm' : 'default'} variant="outline" onclick={remove} disabled={removeCommit.isPending}>
    <TrashIcon aria-hidden="true" />
    Delete
  </Button>
{/snippet}

<div>
  {#if commit.isPending}
    <DetailSkeleton />
  {:else if commit.isError}
    {#if isPage}
      <PageHeader title="Commit" breadcrumbs={[{ label: 'Commits', href: paths.commits() }, { label: 'Commit' }]} />
    {/if}
    <ErrorState
      error={commit.error}
      title={notFound ? 'Commit not found' : 'This commit could not be loaded'}
      message={notFound ? 'It may have been deleted, or the link is wrong.' : undefined}
      onretry={notFound ? undefined : () => commit.refetch()}
      retrying={commit.isFetching}
    />
    {#if isPage}
      <div class="mt-4">
        <Button variant="outline" href={paths.commits()}>Back to commits</Button>
      </div>
    {/if}
  {:else}
    {@const data = commit.data}
    {@const body = commitBody(data.commit_message)}
    {@const externalUrl = safeExternalUrl(data.external_url)}

    {#if isPage}
      <PageHeader
        title={commitSubject(data.commit_message)}
        breadcrumbs={[
          { label: 'Commits', href: paths.commits() },
          { label: data.project.name, href: paths.commits({ project_id: data.project_id }) },
          { label: data.short_hash },
        ]}
      >
        {#snippet actions()}
          {@render actionButtons(false)}
        {/snippet}
      </PageHeader>
    {:else}
      <header class="mb-5 flex flex-col gap-3">
        <div class="flex min-w-0 flex-col gap-1">
          <p class="text-muted-foreground flex items-center gap-1.5 text-xs">
            <a href={paths.project(data.project.id)} class="hover:text-foreground">{data.project.name}</a>
            <span aria-hidden="true">·</span>
            <code class="font-mono">{data.short_hash}</code>
          </p>
          <h2 class="text-foreground text-lg font-semibold break-words">{commitSubject(data.commit_message)}</h2>
        </div>
        <div class="flex flex-wrap gap-2">{@render actionButtons(true)}</div>
      </header>
    {/if}

    <div class={cn('grid gap-6', isPage && 'lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]')}>
      <div class="flex min-w-0 flex-col gap-6">
        <section aria-labelledby="commit-hash-heading" class="bg-card rounded-lg border p-4">
          <h2 id="commit-hash-heading" class="eyebrow mb-2">Commit hash</h2>
          <div class="flex items-start gap-2">
            <code class="text-foreground min-w-0 flex-1 font-mono text-sm break-all">{data.commit_hash}</code>
            <CopyButton value={data.commit_hash} label="Copy commit hash" text="Copy hash" variant="outline" size="sm" />
          </div>
          {#if body}
            <pre class="text-muted-foreground mt-3 border-t pt-3 font-sans text-sm whitespace-pre-wrap">{body}</pre>
          {/if}
        </section>

        {#if data.description}
          <section aria-labelledby="commit-description-heading">
            <h2 id="commit-description-heading" class="mb-2 text-sm font-semibold">Description</h2>
            <p class="text-foreground text-sm whitespace-pre-wrap">{data.description}</p>
          </section>
        {/if}

        <section aria-labelledby="commit-deployments-heading">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="commit-deployments-heading" class="text-sm font-semibold">Recorded deployments</h2>
            {#if data.deployment_count > 0}
              <a href={paths.deployments({ commit_id: data.id })} class="text-brand text-sm hover:underline">
                Open in deployment history
              </a>
            {/if}
          </div>

          {#if data.environments.length === 0}
            <EmptyState
              icon={RocketIcon}
              title="No deployment recorded for this commit"
              description="That only means nothing has been noted in CommitVault. Record a deployment when this commit goes out to an environment."
              compact
            >
              {#snippet action()}
                <Button variant="outline" onclick={() => (deployOpen = true)}>Record deployment</Button>
              {/snippet}
            </EmptyState>
          {:else}
            <ul aria-label="Environments with a deployment record" class="mb-5 grid gap-2 sm:grid-cols-2">
              {#each data.environments as environment (environment.id)}
                <li class="bg-card flex flex-col gap-1.5 rounded-lg border p-3">
                  <div class="flex items-center justify-between gap-2">
                    <EnvironmentBadge
                      name={environment.name}
                      color={environment.color}
                      href={paths.deployments({ commit_id: data.id, project_id: data.project_id, environment_id: environment.id })}
                    />
                    <StatusBadge status={environment.latest_status} />
                  </div>
                  <p class="text-muted-foreground text-xs">
                    Latest record <DateTime value={environment.latest_deployed_at} mode="both" />
                    · {pluralize(environment.deployment_count, 'record')}
                  </p>
                </li>
              {/each}
            </ul>

            {#if history.isPending}
              <ListSkeleton rows={3} />
            {:else if history.isError}
              <ErrorState error={history.error} onretry={() => history.refetch()} retrying={history.isFetching} compact />
            {:else}
              <DeploymentTimeline
                deployments={history.data.data}
                showCommit={false}
                label="Deployment records of this commit"
              />
              {#if history.data.meta.total > history.data.data.length}
                <p class="text-muted-foreground mt-3 text-sm">
                  Showing the latest {history.data.data.length} of {pluralize(history.data.meta.total, 'record')}.
                  <a href={paths.deployments({ commit_id: data.id })} class="text-brand hover:underline">View all</a>
                </p>
              {/if}
            {/if}
          {/if}
        </section>
      </div>

      <aside class="flex min-w-0 flex-col gap-6" aria-label="Commit details">
        <section class="bg-card rounded-lg border p-4">
          <h2 class="mb-3 text-sm font-semibold">Details</h2>
          <dl class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm">
            <dt class="text-muted-foreground">Project</dt>
            <dd><a href={paths.project(data.project.id)} class="text-brand hover:underline">{data.project.name}</a></dd>

            <dt class="text-muted-foreground">Branch</dt>
            <dd>
              <BranchBadge name={data.branch.name} href={paths.branch(data.branch_id)} />
            </dd>

            <dt class="text-muted-foreground">Short hash</dt>
            <dd class="flex items-center gap-1">
              <code class="font-mono text-xs">{data.short_hash}</code>
              <CopyButton value={data.short_hash} label="Copy short hash" size="icon-xs" variant="ghost" />
            </dd>

            <dt class="text-muted-foreground">Commit date</dt>
            <dd><DateTime value={data.commit_date} mode="datetime" /></dd>

            <dt class="text-muted-foreground">Author</dt>
            <dd>{data.author_name ?? '—'}</dd>

            <dt class="text-muted-foreground">Recorded</dt>
            <dd><DateTime value={data.created_at} mode="datetime" /></dd>

            {#if data.updated_at !== data.created_at}
              <dt class="text-muted-foreground">Updated</dt>
              <dd><DateTime value={data.updated_at} mode="relative" /></dd>
            {/if}

            <dt class="text-muted-foreground">Tags</dt>
            <dd>
              {#if data.tags.length > 0}
                <span class="flex flex-wrap gap-1">
                  {#each data.tags as tag (tag.id)}
                    <TagBadge name={tag.name} color={tag.color} href={paths.commits({ tag_id: tag.id })} />
                  {/each}
                </span>
              {:else}
                —
              {/if}
            </dd>
          </dl>

          {#if externalUrl}
            <Button
              variant="outline"
              size="sm"
              class="mt-4 w-full"
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLinkIcon aria-hidden="true" />
              Open on Git host
            </Button>
          {/if}
        </section>

        <section class="bg-card rounded-lg border p-4" aria-labelledby="commit-releases-heading">
          <h2 id="commit-releases-heading" class="mb-3 text-sm font-semibold">Releases</h2>
          {#if data.releases.length === 0}
            <p class="text-muted-foreground text-sm">Not associated with a release.</p>
          {:else}
            <ul class="flex flex-col gap-2">
              {#each data.releases as release (release.id)}
                <li class="flex items-center justify-between gap-2">
                  <a href={paths.release(release.id)} class="hover:text-brand min-w-0 truncate text-sm">
                    <span class="font-mono text-xs">{release.version}</span>
                    <span class="text-muted-foreground"> · {release.title}</span>
                  </a>
                  <StatusBadge status={release.status} />
                </li>
              {/each}
            </ul>
          {/if}
        </section>
      </aside>
    </div>

    <CommitFormDialog bind:open={editOpen} commit={data} />
    <DeploymentFormDialog bind:open={deployOpen} projectId={data.project_id} commitId={data.id} />
  {/if}
</div>
