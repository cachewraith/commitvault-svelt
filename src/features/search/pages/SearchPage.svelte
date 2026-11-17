<!--
  Global search (`/search?q=`). The term and scope live in the URL; results are
  grouped by record type and every hit is a plain link, so the page is fully
  keyboard navigable in DOM order.
-->
<script lang="ts">
  import type { Component } from 'svelte';
  import { createQuery, keepPreviousData } from '@tanstack/svelte-query';
  import FolderGitIcon from '@lucide/svelte/icons/folder-git-2';
  import GitCommitIcon from '@lucide/svelte/icons/git-commit-horizontal';
  import NotebookIcon from '@lucide/svelte/icons/notebook-text';
  import PackageIcon from '@lucide/svelte/icons/package';
  import RocketIcon from '@lucide/svelte/icons/rocket';
  import SearchIcon from '@lucide/svelte/icons/search';
  import TagIcon from '@lucide/svelte/icons/tag';
  import { queryKeys } from '$lib/api';
  import { DateTime, EmptyState, ErrorState, ListSkeleton, PageHeader, SearchInput } from '$lib/components';
  import { Button } from '$lib/components/ui/button';
  import { queryNumber, queryString, setPageTitle, setQuery } from '$lib/router';
  import { paths } from '$routes/paths';
  import ProjectSelect from '$features/projects/components/ProjectSelect.svelte';
  import { SEARCH_MAX_CHARS, SEARCH_MIN_CHARS, searchApi } from '../api';
  import { SEARCH_GROUPS, type SearchGroup, type SearchHit } from '../types';

  const DEFAULT_LIMIT = 5;
  const MAX_LIMIT = 20;

  const q = queryString('q');
  const projectId = queryString('project_id');
  const limit = queryNumber('limit', DEFAULT_LIMIT);

  const term = $derived(q.value.trim());
  const length = $derived([...term].length);
  const searchable = $derived(length >= SEARCH_MIN_CHARS && length <= SEARCH_MAX_CHARS);
  const perGroup = $derived(Math.min(Math.max(Math.trunc(limit.value) || DEFAULT_LIMIT, 1), MAX_LIMIT));

  const params = $derived({ q: term, project_id: projectId.value || undefined, limit: perGroup });

  const results = createQuery(() => ({
    queryKey: queryKeys.search.results(params),
    queryFn: ({ signal }) => searchApi.search(params, signal),
    enabled: searchable,
    placeholderData: keepPreviousData,
  }));

  $effect(() => {
    setPageTitle(term ? `Search: ${term}` : 'Search');
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const GROUPS: Record<SearchGroup, { label: string; icon: Component<any>; all: (term: string, project?: string) => string }> = {
    projects: { label: 'Projects', icon: FolderGitIcon, all: (search) => paths.projects({ search }) },
    commits: {
      label: 'Commits',
      icon: GitCommitIcon,
      all: (search, project_id) => paths.commits({ search, project_id }),
    },
    deployments: {
      label: 'Deployments',
      icon: RocketIcon,
      all: (search, project_id) => paths.deployments({ search, project_id }),
    },
    releases: {
      label: 'Releases',
      icon: PackageIcon,
      all: (search, project_id) => paths.releases({ search, project_id }),
    },
    notes: { label: 'Notes', icon: NotebookIcon, all: (search, project_id) => paths.notes({ search, project_id }) },
    tags: { label: 'Tags', icon: TagIcon, all: (search) => paths.tags({ search }) },
  };

  function hitHref(hit: SearchHit): string {
    switch (hit.kind) {
      case 'project':
        return paths.project(hit.id);
      case 'commit':
        return paths.commit(hit.id);
      case 'deployment':
        return paths.deployment(hit.id);
      case 'release':
        return paths.release(hit.id);
      case 'note':
        return paths.note(hit.id);
      case 'tag':
        return paths.tags({ search: hit.title });
    }
  }

  const groups = $derived(
    results.data
      ? SEARCH_GROUPS.map((key) => ({ key, ...GROUPS[key], hits: results.data[key] })).filter(
          (group) => group.hits.length > 0,
        )
      : [],
  );
</script>

<div class="page">
  <PageHeader title="Search" description="Find projects, commits, deployments, releases, notes and tags." />

  <div class="mb-6 flex flex-col gap-2 sm:flex-row" role="search">
    <SearchInput
      value={q.value}
      onsearch={(next) => setQuery({ q: next, limit: null })}
      label="Search everything"
      placeholder="Commit message, branch, hash prefix, note text…"
      class="w-full sm:max-w-xl sm:flex-1"
    />
    <ProjectSelect
      value={projectId.value || null}
      onchange={(id) => setQuery({ project_id: id, limit: null })}
      placeholder="All projects"
      clearable
      includeArchived
      class="w-full sm:w-56"
    />
  </div>

  {#if term === ''}
    <EmptyState
      icon={SearchIcon}
      title="Search your workspace"
      description="Type at least {SEARCH_MIN_CHARS} characters. Commits match by message, branch, author and hash prefix; notes and releases match by their text."
    />
  {:else if length < SEARCH_MIN_CHARS}
    <EmptyState
      icon={SearchIcon}
      title="Keep typing"
      description="Search needs at least {SEARCH_MIN_CHARS} characters."
    />
  {:else if length > SEARCH_MAX_CHARS}
    <EmptyState
      icon={SearchIcon}
      title="That search term is too long"
      description="Use at most {SEARCH_MAX_CHARS} characters."
    />
  {:else if results.isPending}
    <ListSkeleton rows={8} />
  {:else if results.isError}
    <ErrorState error={results.error} onretry={() => results.refetch()} retrying={results.isFetching} />
  {:else if groups.length === 0}
    <EmptyState
      icon={SearchIcon}
      title="No results for “{term}”"
      description="Try a commit message, a branch name, the first characters of a hash, a version, or words from a note.{projectId.value
        ? ' The search is limited to one project — clear the project to search everything.'
        : ''}"
    >
      {#snippet action()}
        {#if projectId.value}
          <Button variant="outline" onclick={() => setQuery({ project_id: null })}>Search all projects</Button>
        {/if}
      {/snippet}
    </EmptyState>
  {:else}
    <p class="text-muted-foreground mb-4 text-sm" role="status">
      Results for <span class="text-foreground font-medium">“{results.data.query}”</span>
      in {groups.length} {groups.length === 1 ? 'category' : 'categories'}
    </p>
    <div class={results.isPlaceholderData ? 'opacity-60 transition-opacity' : ''}>
      {#each groups as group (group.key)}
        {@const full = group.hits.length >= perGroup}
        <section aria-labelledby="search-group-{group.key}" class="mb-6">
          <div class="mb-2 flex items-center justify-between gap-2">
            <h2 id="search-group-{group.key}" class="flex items-center gap-2 text-sm font-semibold">
              <group.icon class="text-muted-foreground size-4" aria-hidden="true" />
              {group.label}
              <span class="text-muted-foreground tabular font-normal">
                ({group.hits.length}{full ? '+' : ''})
              </span>
            </h2>
            {#if full && perGroup < MAX_LIMIT}
              <Button variant="ghost" size="sm" onclick={() => (limit.value = MAX_LIMIT)}>Show more</Button>
            {:else if full}
              <a href={group.all(term, projectId.value || undefined)} class="text-brand text-sm hover:underline">
                View all in {group.label.toLowerCase()}
              </a>
            {/if}
          </div>
          <ul class="bg-card divide-y rounded-lg border">
            {#each group.hits as hit (hit.id)}
              <li>
                <a
                  href={hitHref(hit)}
                  class="hover:bg-muted/60 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2 text-sm transition-colors"
                >
                  <span class="text-foreground min-w-0 flex-1 basis-60 truncate font-medium">{hit.title}</span>
                  {#if hit.project}
                    <span class="text-muted-foreground max-w-[22ch] shrink-0 truncate text-xs">{hit.project.name}</span>
                  {/if}
                  {#if hit.occurred_at}
                    <DateTime value={hit.occurred_at} class="text-muted-foreground tabular shrink-0 text-xs" />
                  {/if}
                  {#if hit.subtitle}
                    <span
                      class="text-muted-foreground basis-full truncate text-xs {hit.kind === 'commit'
                        ? 'font-mono'
                        : ''}"
                    >
                      {hit.subtitle}
                    </span>
                  {/if}
                </a>
              </li>
            {/each}
          </ul>
        </section>
      {/each}
    </div>
  {/if}
</div>
