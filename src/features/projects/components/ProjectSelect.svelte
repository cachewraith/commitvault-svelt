<!--
  Searchable single select of projects (server-side search). Use inside
  <FormField> by spreading the field attrs onto it:

    <FormField label="Project" error={errors.project_id} required>
      {#snippet children(field)}
        <ProjectSelect {...field} bind:value={projectId} />
      {/snippet}
    </FormField>
-->
<script lang="ts">
  import { createQuery, keepPreviousData } from '@tanstack/svelte-query';
  import { queryKeys } from '$lib/api';
  import { Combobox, type ComboboxOption } from '$lib/components';
  import { projectsApi, type ProjectListParams } from '../api';

  interface Props {
    /** Selected project id. */
    value?: string | null;
    onchange?: (projectId: string | null) => void;
    placeholder?: string;
    clearable?: boolean;
    /** Also offer archived projects (default: active only). */
    includeArchived?: boolean;
    disabled?: boolean;
    id?: string;
    'aria-invalid'?: boolean | 'true' | 'false';
    'aria-describedby'?: string;
    'aria-required'?: boolean | 'true' | 'false';
    'aria-label'?: string;
    class?: string;
  }

  let {
    value = $bindable(null),
    onchange,
    placeholder = 'Select a project',
    clearable = false,
    includeArchived = false,
    disabled = false,
    id,
    'aria-invalid': ariaInvalid,
    'aria-describedby': ariaDescribedBy,
    'aria-label': ariaLabel,
    class: className,
  }: Props = $props();

  let search = $state('');

  const params = $derived<ProjectListParams>({
    search: search || undefined,
    status: includeArchived ? undefined : 'active',
    sort: 'name',
    order: 'asc',
    per_page: 25,
  });

  const projects = createQuery(() => ({
    queryKey: queryKeys.projects.list(params),
    queryFn: ({ signal }) => projectsApi.list(params, signal),
    placeholderData: keepPreviousData,
    enabled: !disabled,
  }));

  const options = $derived<ComboboxOption[]>(
    (projects.data?.data ?? []).map((project) => ({
      value: project.id,
      label: project.name,
      description: project.status === 'archived' ? `${project.slug} · archived` : project.slug,
    })),
  );

  // The selection may be outside the current result page (or archived):
  // fetch it on its own so the trigger always shows its name.
  const inPage = $derived(value ? options.some((option) => option.value === value) : true);
  const selected = createQuery(() => ({
    queryKey: queryKeys.projects.detail(value ?? ''),
    queryFn: ({ signal }) => projectsApi.get(value ?? '', signal),
    enabled: Boolean(value) && !inPage,
  }));
</script>

<Combobox
  {options}
  bind:value
  {onchange}
  {placeholder}
  searchPlaceholder="Search projects…"
  emptyText="No projects found."
  selectedLabel={selected.data?.name}
  onsearch={(query) => (search = query)}
  loading={projects.isPending && !disabled}
  {clearable}
  {disabled}
  {id}
  aria-invalid={ariaInvalid === true || ariaInvalid === 'true' ? 'true' : undefined}
  aria-describedby={ariaDescribedBy}
  aria-label={ariaLabel}
  class={className}
/>
