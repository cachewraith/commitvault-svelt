<!-- Project list: search, status / tag filters, sortable table, create / edit / archive / delete. -->
<script lang="ts">
  import { createMutation, createQuery, keepPreviousData, useQueryClient } from '@tanstack/svelte-query';
  import ArchiveIcon from '@lucide/svelte/icons/archive';
  import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
  import FolderGitIcon from '@lucide/svelte/icons/folder-git-2';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
  import SettingsIcon from '@lucide/svelte/icons/settings';
  import TrashIcon from '@lucide/svelte/icons/trash';
  import { queryKeys, removeFromCache, type SortOrder } from '$lib/api';
  import {
    BranchBadge,
    confirm,
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
    PageHeader,
    Pagination,
    SearchInput,
    StatusBadge,
    TableSkeleton,
    TagBadge,
    toast,
    toastError,
  } from '$lib/components';
  import { Button } from '$lib/components/ui/button';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import { navigate, queryEnum, queryNumber, queryString, setQuery } from '$lib/router';
  import { formatNumber, safeExternalUrl } from '$lib/utils';
  import { paths } from '$routes/paths';
  import TagSelect from '$features/tags/components/TagSelect.svelte';
  import { projectsApi, type ProjectListParams } from '../api';
  import FilterSelect from '../components/FilterSelect.svelte';
  import ProjectFormDialog from '../components/ProjectFormDialog.svelte';
  import { deleteProjectDescription, invalidateAllProjectData } from '../queries';
  import type { Project, ProjectSort, ProjectStatus } from '../types';

  const STATUS_OPTIONS = [
    { value: 'active', label: 'Active' },
    { value: 'archived', label: 'Archived' },
    { value: 'all', label: 'All' },
  ] as const;
  const SORTS = ['name', 'created_at', 'updated_at'] as const satisfies readonly ProjectSort[];

  const queryClient = useQueryClient();

  const page = queryNumber('page', 1);
  const search = queryString('search');
  const status = queryEnum('status', ['active', 'archived', 'all'], 'active');
  const tagId = queryString('tag_id');
  const sort = queryEnum('sort', SORTS, 'updated_at');
  const order = queryEnum('order', ['asc', 'desc']);

  const params = $derived<ProjectListParams>({
    page: page.value,
    per_page: 25,
    search: search.value || undefined,
    status: status.value === 'all' ? undefined : status.value,
    tag_id: tagId.value || undefined,
    sort: sort.value,
    order: order.value,
  });

  const projects = createQuery(() => ({
    queryKey: queryKeys.projects.list(params),
    queryFn: ({ signal }) => projectsApi.list(params, signal),
    placeholderData: keepPreviousData,
  }));

  const filtered = $derived(search.value !== '' || status.value !== 'active' || tagId.value !== '');
  /** Sort direction in effect (the server picks A→Z for names, newest first otherwise). */
  const effectiveOrder = $derived<SortOrder>(order.value ?? (sort.value === 'name' ? 'asc' : 'desc'));

  let createOpen = $state(false);
  let editOpen = $state(false);
  let editing = $state.raw<Project | undefined>(undefined);

  function edit(project: Project) {
    editing = project;
    editOpen = true;
  }

  const setStatus = createMutation(() => ({
    mutationFn: (input: { project: Project; status: ProjectStatus }) =>
      projectsApi.update(input.project.id, { status: input.status }),
    onSuccess: (project) => {
      invalidateAllProjectData(queryClient);
      toast.success(project.status === 'archived' ? `“${project.name}” archived` : `“${project.name}” restored`);
    },
    onError: (error) => toastError(error, 'Could not update the project.'),
  }));

  const remove = createMutation(() => ({
    mutationFn: (project: Project) => projectsApi.remove(project.id),
    // Optimistic: the card disappears at once; restored if the server refuses.
    onMutate: (project) => {
      const restore = removeFromCache(queryClient, project.id, [queryKeys.projects.lists(), queryKeys.dashboard.all]);
      toast.success(`Project “${project.name}” deleted`);
      return { restore };
    },
    onError: (error, _project, context) => {
      context?.restore();
      toastError(error, 'Could not delete the project. It is back in the list.');
    },
    onSettled: () => invalidateAllProjectData(queryClient),
  }));

  async function archive(project: Project) {
    const ok = await confirm({
      title: `Archive “${project.name}”?`,
      description:
        'Archived projects are hidden from the dashboard and from pickers. Nothing is deleted and you can restore the project at any time.',
      confirmLabel: 'Archive',
    });
    if (ok) setStatus.mutate({ project, status: 'archived' });
  }

  async function destroy(project: Project) {
    const ok = await confirm({
      title: `Delete project “${project.name}”?`,
      description: deleteProjectDescription(project),
      confirmLabel: 'Delete project',
      destructive: true,
    });
    if (ok) remove.mutate(project);
  }

  function onsort(nextSort: string, nextOrder: SortOrder) {
    setQuery({ sort: nextSort === 'updated_at' ? null : nextSort, order: nextOrder, page: null });
  }
</script>

<div class="page">
  <PageHeader title="Projects">
    {#snippet actions()}
      <Button onclick={() => (createOpen = true)}>
        <PlusIcon aria-hidden="true" />
        New project
      </Button>
    {/snippet}
  </PageHeader>

  <FilterBar
    active={filtered}
    onreset={() => setQuery({ search: null, status: null, tag_id: null, page: null })}
    label="Project filters"
  >
    <SearchInput
      value={search.value}
      onsearch={(query) => setQuery({ search: query, page: null })}
      label="Search projects"
      placeholder="Search by name, slug or description"
      class="w-full sm:w-72"
    />
    <FilterSelect
      label="Status"
      options={STATUS_OPTIONS}
      value={status.value}
      onchange={(next) => setQuery({ status: next === 'active' ? null : next, page: null })}
    />
    <TagSelect value={tagId.value || null} onchange={(id) => setQuery({ tag_id: id, page: null })} />
  </FilterBar>

  {#if projects.isPending}
    <TableSkeleton rows={6} columns={6} />
  {:else if projects.isError}
    <ErrorState error={projects.error} onretry={() => projects.refetch()} retrying={projects.isFetching} />
  {:else if projects.data.data.length === 0}
    {#if filtered}
      <EmptyState
        icon={FolderGitIcon}
        title="No projects match these filters"
        description={status.value === 'active'
          ? 'Try a different search, or include archived projects.'
          : 'Try a different search or clear the filters.'}
      >
        {#snippet action()}
          <Button variant="outline" onclick={() => setQuery({ search: null, status: null, tag_id: null, page: null })}>
            Clear filters
          </Button>
        {/snippet}
      </EmptyState>
    {:else}
      <EmptyState
        icon={FolderGitIcon}
        title="No projects yet"
        description="A project holds the commits, environments, deployment records, releases and notes you want to remember. Create your first one to get started."
      >
        {#snippet action()}
          <Button onclick={() => (createOpen = true)}>
            <PlusIcon aria-hidden="true" />
            New project
          </Button>
        {/snippet}
      </EmptyState>
    {/if}
  {:else}
    <DataTable label="Projects">
      <DataTableHeader>
        <DataTableRow>
          <DataTableHead sortKey="name" sort={sort.value} order={effectiveOrder} {onsort} defaultOrder="asc">
            Project
          </DataTableHead>
          <DataTableHead>Default branch</DataTableHead>
          <DataTableHead align="right">Commits</DataTableHead>
          <DataTableHead align="right">Environments</DataTableHead>
          <DataTableHead align="right">Deployment records</DataTableHead>
          <DataTableHead>Last recorded deployment</DataTableHead>
          <DataTableHead sortKey="updated_at" sort={sort.value} order={effectiveOrder} {onsort}>
            Updated
          </DataTableHead>
          <DataTableHead align="right"><span class="sr-only">Actions</span></DataTableHead>
        </DataTableRow>
      </DataTableHeader>
      <DataTableBody>
        {#each projects.data.data as project (project.id)}
          {@const repositoryUrl = safeExternalUrl(project.repository_url)}
          <DataTableRow href={paths.project(project.id)}>
            <DataTableCell wrap class="max-w-md min-w-56">
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                <a href={paths.project(project.id)} class="text-foreground font-medium hover:underline">
                  {project.name}
                </a>
                <span class="text-muted-foreground font-mono text-xs">{project.slug}</span>
                {#if project.status === 'archived'}
                  <StatusBadge status="archived" />
                {/if}
                {#if repositoryUrl}
                  <a
                    href={repositoryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-muted-foreground hover:text-foreground"
                    aria-label={`Open the repository of ${project.name} in a new tab`}
                  >
                    <ExternalLinkIcon class="size-3.5" aria-hidden="true" />
                  </a>
                {/if}
              </div>
              {#if project.description}
                <p class="text-muted-foreground mt-0.5 line-clamp-1 text-xs">{project.description}</p>
              {/if}
              {#if project.tags.length > 0}
                <div class="mt-1.5 flex flex-wrap gap-1">
                  {#each project.tags as tag (tag.id)}
                    <TagBadge name={tag.name} color={tag.color} href={paths.projects({ tag_id: tag.id })} />
                  {/each}
                </div>
              {/if}
            </DataTableCell>
            <DataTableCell><BranchBadge name={project.default_branch} /></DataTableCell>
            <DataTableCell align="right" class="tabular">{formatNumber(project.stats.commit_count)}</DataTableCell>
            <DataTableCell align="right" class="tabular">
              {formatNumber(project.stats.environment_count)}
            </DataTableCell>
            <DataTableCell align="right" class="tabular">
              {formatNumber(project.stats.deployment_count)}
            </DataTableCell>
            <DataTableCell class="tabular">
              <DateTime value={project.stats.last_deployed_at} fallback="None recorded" />
            </DataTableCell>
            <DataTableCell class="tabular"><DateTime value={project.updated_at} /></DataTableCell>
            <DataTableCell align="right">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                  {#snippet child({ props })}
                    <Button {...props} variant="ghost" size="icon-sm" aria-label={`Actions for ${project.name}`}>
                      <EllipsisIcon aria-hidden="true" />
                    </Button>
                  {/snippet}
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end" class="w-44">
                  <DropdownMenu.Item onSelect={() => edit(project)}>
                    <PencilIcon aria-hidden="true" />
                    Edit
                  </DropdownMenu.Item>
                  <DropdownMenu.Item onSelect={() => navigate(paths.projectSettings(project.id))}>
                    <SettingsIcon aria-hidden="true" />
                    Settings
                  </DropdownMenu.Item>
                  {#if project.status === 'archived'}
                    <DropdownMenu.Item onSelect={() => setStatus.mutate({ project, status: 'active' })}>
                      <RotateCcwIcon aria-hidden="true" />
                      Restore
                    </DropdownMenu.Item>
                  {:else}
                    <DropdownMenu.Item onSelect={() => archive(project)}>
                      <ArchiveIcon aria-hidden="true" />
                      Archive
                    </DropdownMenu.Item>
                  {/if}
                  <DropdownMenu.Separator />
                  <DropdownMenu.Item variant="destructive" onSelect={() => destroy(project)}>
                    <TrashIcon aria-hidden="true" />
                    Delete
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            </DataTableCell>
          </DataTableRow>
        {/each}
      </DataTableBody>
      {#snippet footer()}
        <Pagination meta={projects.data.meta} onchange={(next) => (page.value = next)} label="projects" />
      {/snippet}
    </DataTable>
  {/if}
</div>

<ProjectFormDialog bind:open={createOpen} onsaved={(project) => navigate(paths.project(project.id))} />
<ProjectFormDialog bind:open={editOpen} project={editing} />
