<!-- Tags: usage per record type (each count links to the filtered list), create / edit / delete. -->
<script lang="ts">
  import { createMutation, createQuery, keepPreviousData, useQueryClient } from '@tanstack/svelte-query';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import TagsIcon from '@lucide/svelte/icons/tags';
  import TrashIcon from '@lucide/svelte/icons/trash';
  import { queryKeys, removeFromCache, type SortOrder } from '$lib/api';
  import {
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
    TableSkeleton,
    TagBadge,
    toast,
    toastError,
    SortSelect,
  } from '$lib/components';
  import { Button } from '$lib/components/ui/button';
  import {queryNumber, queryString, setQuery, type SortOption, sortState} from '$lib/router';
  import { formatNumber, pluralize } from '$lib/utils';
  import { paths } from '$routes/paths';
  import { tagsApi, type TagListParams } from '../api';
  import TagFormDialog from '../components/TagFormDialog.svelte';
  import { invalidateTaggedResources } from '../queries';
  import type { Tag, TagSort } from '../types';


  const queryClient = useQueryClient();

  const page = queryNumber('page', 1);
  const search = queryString('search');
  const SORT_OPTIONS = [
    { sort: 'created_at', order: 'desc', label: 'Newest first' },
    { sort: 'created_at', order: 'asc', label: 'Oldest first' },
    { sort: 'name', order: 'asc', label: 'Name A–Z' },
    { sort: 'name', order: 'desc', label: 'Name Z–A' },
    { sort: 'usage', order: 'desc', label: 'Most used' },
  ] as const satisfies readonly SortOption<TagSort>[];
  const sorting = sortState(SORT_OPTIONS);

  const params = $derived<TagListParams>({
    page: page.value,
    per_page: 50,
    search: search.value || undefined,
    sort: sorting.sort,
    order: sorting.order,
  });

  const tags = createQuery(() => ({
    queryKey: queryKeys.tags.list(params),
    queryFn: ({ signal }) => tagsApi.list(params, signal),
    placeholderData: keepPreviousData,
  }));

  /** Sort direction in effect (the server defaults to A→Z for names, highest first otherwise). */

  let dialogOpen = $state(false);
  let editing = $state.raw<Tag | undefined>(undefined);

  function openCreate() {
    editing = undefined;
    dialogOpen = true;
  }

  function openEdit(tag: Tag) {
    editing = tag;
    dialogOpen = true;
  }

  const remove = createMutation(() => ({
    mutationFn: (tag: Tag) => tagsApi.remove(tag.id),
    // Optimistic: the row disappears at once; restored if the server refuses.
    onMutate: (tag) => {
      const restore = removeFromCache(queryClient, tag.id, [queryKeys.tags.all]);
      toast.success(`Tag “${tag.name}” deleted`);
      return { restore };
    },
    onError: (error, _tag, context) => {
      context?.restore();
      toastError(error, 'Could not delete the tag. It is back in the list.');
    },
    onSettled: () => invalidateTaggedResources(queryClient),
  }));

  async function destroy(tag: Tag) {
    const used = tag.usage.total;
    const ok = await confirm({
      title: `Delete tag “${tag.name}”?`,
      description:
        used === 0
          ? 'No record uses this tag.'
          : `${pluralize(used, 'record')} will lose this tag. The records themselves are not changed.`,
      confirmLabel: 'Delete tag',
      destructive: true,
    });
    if (ok) remove.mutate(tag);
  }

  function onsort(nextSort: string, nextOrder: SortOrder) {
    sorting.set(nextSort, nextOrder);
  }

  /** Usage columns: label, count accessor and the list that shows those records. */
  const USAGE_COLUMNS = [
    { label: 'Projects', count: (tag: Tag) => tag.usage.project_count, href: (id: string) => paths.projects({ tag_id: id, status: 'all' }) },
    { label: 'Commits', count: (tag: Tag) => tag.usage.commit_count, href: (id: string) => paths.commits({ tag_id: id }) },
    { label: 'Deployments', count: (tag: Tag) => tag.usage.deployment_count, href: (id: string) => paths.deployments({ tag_id: id }) },
    { label: 'Releases', count: (tag: Tag) => tag.usage.release_count, href: (id: string) => paths.releases({ tag_id: id }) },
    { label: 'Notes', count: (tag: Tag) => tag.usage.note_count, href: (id: string) => paths.notes({ tag_id: id }) },
  ] as const;
</script>

<div class="page">
  <PageHeader title="Tags" description="Labels you can add to projects, commits, deployments, releases and notes.">
    {#snippet actions()}
      <Button onclick={openCreate}>
        <PlusIcon aria-hidden="true" />
        New tag
      </Button>
    {/snippet}
  </PageHeader>

  <FilterBar active={search.value !== ''} onreset={() => setQuery({ search: null, page: null })} label="Tag filters">
    <SearchInput
      value={search.value}
      onsearch={(query) => setQuery({ search: query, page: null })}
      label="Search tags"
      placeholder="Search tags"
      class="w-full sm:w-72"
    />
    {#snippet actions()}
      <SortSelect options={SORT_OPTIONS} state={sorting} label="Sort tags" />
    {/snippet}
  </FilterBar>

  {#if tags.isPending}
    <TableSkeleton rows={8} columns={7} />
  {:else if tags.isError}
    <ErrorState error={tags.error} onretry={() => tags.refetch()} retrying={tags.isFetching} />
  {:else if tags.data.data.length === 0}
    {#if search.value !== ''}
      <EmptyState icon={TagsIcon} title="No tags match this search" description="Try a different name or clear the search.">
        {#snippet action()}
          <Button variant="outline" onclick={() => setQuery({ search: null, page: null })}>Clear search</Button>
        {/snippet}
      </EmptyState>
    {:else}
      <EmptyState
        icon={TagsIcon}
        title="No tags yet"
        description="Create a tag such as “hotfix” or “needs-migration”, then attach it when you record commits, deployments, releases and notes."
      >
        {#snippet action()}
          <Button onclick={openCreate}>
            <PlusIcon aria-hidden="true" />
            New tag
          </Button>
        {/snippet}
      </EmptyState>
    {/if}
  {:else}
    <DataTable label="Tags">
      <DataTableHeader>
        <DataTableRow>
          <DataTableHead sortKey="name" sort={sorting.sort} order={sorting.order} {onsort} defaultOrder="asc">
            Tag
          </DataTableHead>
          {#each USAGE_COLUMNS as column (column.label)}
            <DataTableHead align="right">{column.label}</DataTableHead>
          {/each}
          <DataTableHead sortKey="usage" sort={sorting.sort} order={sorting.order} {onsort} align="right">
            Total
          </DataTableHead>
          <DataTableHead sortKey="created_at" sort={sorting.sort} order={sorting.order} {onsort}>
            Created
          </DataTableHead>
          <DataTableHead align="right"><span class="sr-only">Actions</span></DataTableHead>
        </DataTableRow>
      </DataTableHeader>
      <DataTableBody>
        {#each tags.data.data as tag (tag.id)}
          <DataTableRow>
            <DataTableCell>
              <div class="flex items-center gap-2">
                <TagBadge name={tag.name} color={tag.color} />
                <span class="text-muted-foreground font-mono text-xs">{tag.slug}</span>
              </div>
            </DataTableCell>
            {#each USAGE_COLUMNS as column (column.label)}
              {@const count = column.count(tag)}
              <DataTableCell align="right" class="tabular">
                {#if count > 0}
                  <a
                    href={column.href(tag.id)}
                    class="text-brand hover:underline"
                    aria-label={`${count} ${column.label.toLowerCase()} tagged ${tag.name}`}
                  >
                    {formatNumber(count)}
                  </a>
                {:else}
                  <span class="text-muted-foreground">0</span>
                {/if}
              </DataTableCell>
            {/each}
            <DataTableCell align="right" class="tabular font-medium">{formatNumber(tag.usage.total)}</DataTableCell>
            <DataTableCell class="tabular"><DateTime value={tag.created_at} mode="date" /></DataTableCell>
            <DataTableCell align="right">
              <div class="flex justify-end gap-1">
                <Button variant="ghost" size="icon-sm" aria-label={`Edit tag ${tag.name}`} onclick={() => openEdit(tag)}>
                  <PencilIcon aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete tag ${tag.name}`}
                  disabled={remove.isPending}
                  onclick={() => destroy(tag)}
                >
                  <TrashIcon aria-hidden="true" />
                </Button>
              </div>
            </DataTableCell>
          </DataTableRow>
        {/each}
      </DataTableBody>
      {#snippet footer()}
        <Pagination meta={tags.data.meta} onchange={(next) => (page.value = next)} label="tags" />
      {/snippet}
    </DataTable>
  {/if}
</div>

<TagFormDialog bind:open={dialogOpen} tag={editing} />
