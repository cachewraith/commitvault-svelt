<!--
  One release: metadata, rich-text notes and the commits associated with it.
  Rendered as a full page (`layout="page"`) or inside the release list's
  slide-in panel (`layout="panel"`).
-->
<script lang="ts">
  import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
  import GitCommitIcon from '@lucide/svelte/icons/git-commit-horizontal';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import TrashIcon from '@lucide/svelte/icons/trash';
  import { queryKeys, removeFromCache } from '$lib/api';
  import {
    confirm,
    DateTime,
    DetailSkeleton,
    EmptyState,
    ErrorState,
    PageHeader,
    RichTextViewer,
    StatusBadge,
    TagBadge,
    toast,
    toastError,
  } from '$lib/components';
  import { Button } from '$lib/components/ui/button';
  import { navigate, setPageTitle } from '$lib/router';
  import { cn, pluralize } from '$lib/utils';
  import { paths } from '$routes/paths';
  import CommitList from '$features/commits/components/CommitList.svelte';
  import { releasesApi } from '../api';
  import ReleaseFormDialog from './ReleaseFormDialog.svelte';
  import type { ReleaseDetail, ReleaseStatus } from '../types';

  interface Props {
    releaseId: string;
    layout?: 'page' | 'panel';
    /** After a successful delete. Default: go to the release list. */
    ondeleted?: () => void;
  }

  let { releaseId, layout = 'page', ondeleted }: Props = $props();
  const isPage = $derived(layout === 'page');

  const queryClient = useQueryClient();

  const query = createQuery(() => ({
    queryKey: queryKeys.releases.detail(releaseId),
    queryFn: ({ signal }) => releasesApi.get(releaseId, signal),
  }));
  const release = $derived(query.data);

  $effect(() => {
    if (isPage) setPageTitle(release ? `${release.version} — ${release.title}` : 'Release');
  });

  let editing = $state(false);

  function invalidateRelated() {
    for (const key of [queryKeys.releases.lists(), queryKeys.commits.all, queryKeys.projects.all, queryKeys.dashboard.all]) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  }

  /** The status transitions offered as one-click actions. */
  const transitions: Record<ReleaseStatus, { to: ReleaseStatus; label: string }[]> = {
    draft: [{ to: 'released', label: 'Mark as released' }],
    released: [
      { to: 'deprecated', label: 'Deprecate' },
      { to: 'draft', label: 'Back to draft' },
    ],
    deprecated: [
      { to: 'released', label: 'Mark as released' },
      { to: 'draft', label: 'Back to draft' },
    ],
  };

  const STATUS_TOASTS: Record<ReleaseStatus, string> = {
    draft: 'Release moved back to draft',
    released: 'Release marked as released',
    deprecated: 'Release deprecated',
  };

  const changeStatus = createMutation(() => ({
    mutationFn: (status: ReleaseStatus) => releasesApi.update(releaseId, { status }),
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.releases.detail(releaseId), saved);
      invalidateRelated();
      toast.success(STATUS_TOASTS[saved.status]);
    },
    onError: (error) => toastError(error, 'Could not change the status.'),
  }));

  const remove = createMutation(() => ({
    mutationFn: () => releasesApi.remove(releaseId),
    // Optimistic: gone from every list at once; restored if the server refuses.
    onMutate: () => {
      const restore = removeFromCache(queryClient, releaseId, [queryKeys.releases.lists(), queryKeys.dashboard.all]);
      toast.success('Release deleted');
      if (ondeleted) ondeleted();
      else navigate(paths.releases(), { replace: true });
      return { restore };
    },
    onSuccess: () => queryClient.removeQueries({ queryKey: queryKeys.releases.detail(releaseId) }),
    onError: (error, _input, context) => {
      context?.restore();
      toastError(error, 'Could not delete the release. It is back in the list.');
    },
    onSettled: () => invalidateRelated(),
  }));

  async function deleteRelease(current: ReleaseDetail) {
    const ok = await confirm({
      title: `Delete release ${current.version}?`,
      description:
        current.commit_count > 0
          ? `The release and its notes are removed. Its ${pluralize(current.commit_count, 'commit')} stay recorded in the project.`
          : 'The release and its notes are removed. This cannot be undone.',
      confirmLabel: 'Delete release',
      destructive: true,
    });
    if (ok) remove.mutate();
  }
</script>

{#snippet actionButtons(current: ReleaseDetail, compact: boolean)}
  {#each transitions[current.status] as transition (transition.to)}
    <Button
      variant="outline"
      size={compact ? 'sm' : 'default'}
      disabled={changeStatus.isPending}
      onclick={() => changeStatus.mutate(transition.to)}
    >
      {transition.label}
    </Button>
  {/each}
  <Button variant="outline" size={compact ? 'sm' : 'default'} onclick={() => (editing = true)}>
    <PencilIcon aria-hidden="true" />
    Edit
  </Button>
  <Button
    variant="outline"
    size={compact ? 'sm' : 'default'}
    class="text-danger hover:text-danger"
    disabled={remove.isPending}
    onclick={() => deleteRelease(current)}
  >
    <TrashIcon aria-hidden="true" />
    Delete
  </Button>
{/snippet}

<div>
  {#if query.isPending}
    <DetailSkeleton />
  {:else if query.isError}
    {#if isPage}
      <PageHeader title="Release" breadcrumbs={[{ label: 'Releases', href: paths.releases() }, { label: 'Release' }]} />
    {/if}
    <ErrorState error={query.error} onretry={() => query.refetch()} retrying={query.isFetching} />
  {:else if release}
    {#if isPage}
      <PageHeader
        title="{release.version} — {release.title}"
        description={release.description ?? undefined}
        breadcrumbs={[
          { label: 'Releases', href: paths.releases() },
          { label: release.project.name, href: paths.releases({ project_id: release.project.id }) },
          { label: release.version },
        ]}
      >
        {#snippet meta()}
          <StatusBadge status={release.status} />
        {/snippet}
        {#snippet actions()}
          {@render actionButtons(release, false)}
        {/snippet}
      </PageHeader>
    {:else}
      <header class="mb-5 flex flex-col gap-3">
        <div class="flex min-w-0 flex-col gap-1.5">
          <p class="text-muted-foreground flex items-center gap-1.5 text-xs">
            <a href={paths.project(release.project.id)} class="hover:text-foreground">{release.project.name}</a>
            <span aria-hidden="true">·</span>
            <code class="font-mono">{release.version}</code>
          </p>
          <h2 class="text-foreground text-lg font-semibold break-words">{release.title}</h2>
          {#if release.description}
            <p class="text-muted-foreground text-sm">{release.description}</p>
          {/if}
          <div><StatusBadge status={release.status} /></div>
        </div>
        <div class="flex flex-wrap gap-2">{@render actionButtons(release, true)}</div>
      </header>
    {/if}

    <div class={cn('grid gap-6', isPage && 'lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]')}>
      <div class="flex min-w-0 flex-col gap-6">
        <section aria-labelledby="release-notes-heading" class="bg-card rounded-lg border p-4">
          <h2 id="release-notes-heading" class="mb-3 text-sm font-semibold">Release notes</h2>
          <RichTextViewer value={release.release_notes ?? null} emptyText="No release notes written yet." />
        </section>

        <section aria-labelledby="release-commits-heading" class="bg-card rounded-lg border p-4">
          <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 id="release-commits-heading" class="text-sm font-semibold">
              Included commits
              <span class="text-muted-foreground tabular font-normal">({release.commits.length})</span>
            </h2>
            {#if release.commits.length > 0}
              <a href={paths.commits({ release_id: release.id })} class="text-brand text-sm hover:underline">
                Open in commits
              </a>
            {/if}
          </div>
          {#if release.commits.length === 0}
            <EmptyState
              compact
              bordered={false}
              icon={GitCommitIcon}
              title="No commits associated"
              description="Add the commits that are part of this release so it is clear what shipped."
            >
              {#snippet action()}
                <Button variant="outline" onclick={() => (editing = true)}>Add commits</Button>
              {/snippet}
            </EmptyState>
          {:else}
            <CommitList commits={release.commits} label="Commits in this release" />
          {/if}
        </section>
      </div>

      <aside aria-label="Release details" class="bg-card h-fit rounded-lg border p-4">
        <h2 class="mb-3 text-sm font-semibold">Details</h2>
        <dl class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm">
          <dt class="text-muted-foreground">Project</dt>
          <dd>
            <a href={paths.project(release.project.id)} class="text-brand hover:underline">{release.project.name}</a>
          </dd>
          <dt class="text-muted-foreground">Version</dt>
          <dd class="font-mono text-[0.8125rem]">{release.version}</dd>
          <dt class="text-muted-foreground">Status</dt>
          <dd><StatusBadge status={release.status} variant="dot" /></dd>
          <dt class="text-muted-foreground">Released</dt>
          <dd class="tabular">
            {#if release.released_at}
              <DateTime value={release.released_at} mode="datetime" />
            {:else}
              <span class="text-muted-foreground">Not released</span>
            {/if}
          </dd>
          <dt class="text-muted-foreground">Created</dt>
          <dd class="tabular"><DateTime value={release.created_at} mode="datetime" /></dd>
          <dt class="text-muted-foreground">Updated</dt>
          <dd class="tabular"><DateTime value={release.updated_at} /></dd>
          <dt class="text-muted-foreground">Tags</dt>
          <dd class="flex flex-wrap gap-1">
            {#each release.tags as tag (tag.id)}
              <TagBadge name={tag.name} color={tag.color} href={paths.releases({ tag_id: tag.id })} />
            {:else}
              <span class="text-muted-foreground">None</span>
            {/each}
          </dd>
        </dl>
      </aside>
    </div>

    <ReleaseFormDialog bind:open={editing} {release} />
  {/if}
</div>
