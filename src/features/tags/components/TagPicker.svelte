<!--
  Multi select of tags with create-on-the-fly. Bind `values` to the form's
  `tag_ids`; `selected` supplies labels for ids that are already attached
  (pass the record's `tags`).

    <TagPicker bind:values={values.tag_ids} selected={commit.tags} />

  Typing a name that does not exist offers "Create «name»". If the server
  answers that the tag already exists (409), the existing tag is selected.
-->
<script lang="ts">
  import { createMutation, createQuery, keepPreviousData, useQueryClient } from '@tanstack/svelte-query';
  import { isApiError, queryKeys } from '$lib/api';
  import { MultiCombobox, TagBadge, toast, toastError, type ComboboxOption } from '$lib/components';
  import { cn } from '$lib/utils';
  import { tagsApi, type TagListParams } from '../api';
  import { invalidateTagLists } from '../queries';
  import type { TagRef } from '../types';

  interface Props {
    values?: string[];
    selected?: TagRef[];
    onchange?: (tagIds: string[]) => void;
    disabled?: boolean;
    id?: string;
    'aria-invalid'?: boolean | 'true' | 'false';
    'aria-describedby'?: string;
    class?: string;
  }

  let {
    values = $bindable([]),
    selected = [],
    onchange,
    disabled = false,
    id,
    'aria-invalid': ariaInvalid,
    'aria-describedby': ariaDescribedBy,
    class: className,
  }: Props = $props();

  const queryClient = useQueryClient();

  let search = $state('');
  /** Tags created (or resolved) during this session of the picker. */
  let created = $state.raw<TagRef[]>([]);

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

  /** Everything we know about by id: attached tags, created tags, the current result page. */
  const known = $derived.by(() => {
    const map = new Map<string, TagRef>();
    for (const tag of selected) map.set(tag.id, tag);
    for (const tag of created) map.set(tag.id, tag);
    for (const tag of tags.data?.data ?? []) map.set(tag.id, tag);
    return map;
  });

  const options = $derived<ComboboxOption[]>(
    (tags.data?.data ?? []).map((tag) => ({ value: tag.id, label: tag.name })),
  );
  const selectedOptions = $derived<ComboboxOption[]>(
    [...known.values()].map((tag) => ({ value: tag.id, label: tag.name })),
  );

  function setValues(next: string[]) {
    values = next;
    onchange?.(next);
  }

  function add(tag: TagRef) {
    created = [...created.filter((item) => item.id !== tag.id), tag];
    if (!values.includes(tag.id)) setValues([...values, tag.id]);
  }

  /** The tag whose name (or slug) matches, when creation reported a duplicate. */
  async function findExisting(name: string): Promise<TagRef | undefined> {
    const wanted = name.trim().toLowerCase();
    const result = await tagsApi.list({ search: name, per_page: 50 });
    return (
      result.data.find((tag) => tag.name.toLowerCase() === wanted) ??
      (result.data.length === 1 ? result.data[0] : undefined)
    );
  }

  const createTag = createMutation(() => ({
    mutationFn: async (name: string): Promise<{ tag: TagRef; existed: boolean }> => {
      try {
        return { tag: await tagsApi.create({ name }), existed: false };
      } catch (error) {
        // "A tag with this name already exists" — use that one instead.
        if (isApiError(error) && error.isConflict) {
          const existing = await findExisting(name);
          if (existing) return { tag: existing, existed: true };
        }
        throw error;
      }
    },
    onSuccess: ({ tag, existed }) => {
      add(tag);
      if (!existed) {
        invalidateTagLists(queryClient);
        toast.success(`Tag “${tag.name}” created`);
      }
    },
    onError: (error) => toastError(error, 'Could not create the tag.'),
  }));
</script>

<div class={cn('flex flex-col gap-2', className)}>
  <MultiCombobox
    {options}
    {selectedOptions}
    values={values}
    onchange={setValues}
    onsearch={(query) => (search = query)}
    oncreate={(name) => createTag.mutate(name)}
    loading={tags.isPending}
    placeholder="Add tags"
    searchPlaceholder="Search or create a tag…"
    emptyText="No tags found. Type a name to create one."
    disabled={disabled || createTag.isPending}
    {id}
    aria-invalid={ariaInvalid === true || ariaInvalid === 'true' ? 'true' : undefined}
    aria-describedby={ariaDescribedBy}
  />

  {#if values.length > 0}
    <ul class="flex flex-wrap gap-1.5" aria-label="Selected tags">
      {#each values as tagId (tagId)}
        {@const tag = known.get(tagId)}
        <li>
          <TagBadge
            name={tag?.name ?? 'Unknown tag'}
            color={tag?.color}
            onremove={disabled ? undefined : () => setValues(values.filter((item) => item !== tagId))}
          />
        </li>
      {/each}
    </ul>
  {/if}
</div>
