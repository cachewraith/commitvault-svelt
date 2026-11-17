<!--
  Single select of a tag, for list filters (`tag_id`):

    <TagSelect value={tagId.value || null} onchange={(id) => setQuery({ tag_id: id, page: null })} />
-->
<script lang="ts">
  import { createQuery, keepPreviousData } from '@tanstack/svelte-query';
  import { queryKeys } from '$lib/api';
  import { Combobox, type ComboboxOption } from '$lib/components';
  import { cn } from '$lib/utils';
  import { tagsApi, type TagListParams } from '../api';

  interface Props {
    value?: string | null;
    onchange?: (tagId: string | null) => void;
    placeholder?: string;
    disabled?: boolean;
    class?: string;
  }

  let {
    value = $bindable(null),
    onchange,
    placeholder = 'Any tag',
    disabled = false,
    class: className,
  }: Props = $props();

  let search = $state('');

  const params = $derived<TagListParams>({
    search: search || undefined,
    sort: 'name',
    order: 'asc',
    per_page: 50,
  });

  const tags = createQuery(() => ({
    queryKey: queryKeys.tags.list(params),
    queryFn: ({ signal }) => tagsApi.list(params, signal),
    placeholderData: keepPreviousData,
  }));

  const options = $derived<ComboboxOption[]>(
    (tags.data?.data ?? []).map((tag) => ({ value: tag.id, label: tag.name })),
  );

  // Keep the trigger labelled when the selected tag is not in the result page.
  const inPage = $derived(value ? options.some((option) => option.value === value) : true);
  const selected = createQuery(() => ({
    queryKey: queryKeys.tags.detail(value ?? ''),
    queryFn: ({ signal }) => tagsApi.get(value ?? '', signal),
    enabled: Boolean(value) && !inPage,
  }));
</script>

<Combobox
  {options}
  bind:value
  {onchange}
  {placeholder}
  searchPlaceholder="Search tags…"
  emptyText="No tags found."
  selectedLabel={selected.data?.name}
  onsearch={(query) => (search = query)}
  loading={tags.isPending}
  clearable
  {disabled}
  aria-label="Filter by tag"
  class={cn('w-44', className)}
/>
