<!--
  Searchable picker of one project's branches (server-side search). With
  `allowCreate`, typing a name that does not exist offers "Add branch «name»",
  which creates the branch and selects it.

    <BranchSelect {projectId} value={branchId} onchange={(id) => (branchId = id ?? '')} allowCreate />
-->
<script lang="ts">
  import { createMutation, createQuery, keepPreviousData, useQueryClient } from '@tanstack/svelte-query';
  import { queryKeys } from '$lib/api';
  import { Combobox, toast, toastError } from '$lib/components';
  import { pluralize } from '$lib/utils';
  import { branchesApi } from '../api';
  import type { Branch } from '../types';
  import { gitBranchName } from '../validation';

  interface Props {
    projectId: string | null;
    /** Selected branch id. */
    value?: string | null;
    onchange?: (branchId: string | null, branch?: Branch) => void;
    /** Name of the selected branch when it is not in the current result page. */
    selectedLabel?: string;
    allowCreate?: boolean;
    placeholder?: string;
    clearable?: boolean;
    disabled?: boolean;
    id?: string;
    'aria-invalid'?: 'true';
    'aria-describedby'?: string;
    'aria-label'?: string;
    class?: string;
  }

  let {
    projectId,
    value = $bindable(null),
    onchange,
    selectedLabel,
    allowCreate = false,
    placeholder = 'Select a branch',
    clearable = false,
    disabled = false,
    id,
    'aria-invalid': ariaInvalid,
    'aria-describedby': ariaDescribedBy,
    'aria-label': ariaLabel,
    class: className,
  }: Props = $props();

  const queryClient = useQueryClient();
  let search = $state('');
  /** Remembers names of branches picked from an earlier search page. */
  let pickedLabel = $state<string | undefined>(undefined);

  const params = $derived({ search: search || undefined, per_page: 50 });
  const branches = createQuery(() => ({
    queryKey: queryKeys.branches.list({ projectId, ...params }),
    queryFn: ({ signal }) => branchesApi.list(projectId ?? '', params, signal),
    enabled: projectId !== null,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  }));

  const items = $derived(projectId === null ? [] : (branches.data?.data ?? []));
  const options = $derived(
    items.map((branch) => ({
      value: branch.id,
      label: branch.name,
      description: [pluralize(branch.commit_count, 'commit'), branch.is_default ? 'default branch' : null]
        .filter(Boolean)
        .join(' · '),
    })),
  );

  const create = createMutation(() => ({
    mutationFn: (name: string) => branchesApi.create(projectId ?? '', { name }),
    onSuccess: (branch: Branch) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.branches.all });
      toast.success(`Branch “${branch.name}” added`);
      select(branch.id, branch);
    },
    onError: (error: unknown) => toastError(error, 'Could not add the branch.'),
  }));

  function oncreate(name: string) {
    const parsed = gitBranchName.safeParse(name);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Is not a valid branch name.');
      return;
    }
    create.mutate(parsed.data);
  }

  function select(next: string | null, branch = items.find((item) => item.id === next)) {
    pickedLabel = branch?.name;
    value = next;
    onchange?.(next, branch);
  }

  const emptyText = $derived(
    search ? 'No branch with that name.' : allowCreate ? 'No branches yet. Type a name to add one.' : 'No branches yet.',
  );
</script>

<Combobox
  {options}
  {value}
  onchange={(next) => select(next)}
  onsearch={(query) => (search = query)}
  oncreate={allowCreate && projectId !== null ? oncreate : undefined}
  createLabel={(name) => `Add branch “${name}”`}
  selectedLabel={pickedLabel ?? selectedLabel}
  placeholder={projectId === null ? 'Select a project first' : placeholder}
  searchPlaceholder="Search branches…"
  {emptyText}
  loading={branches.isPending && projectId !== null}
  {clearable}
  disabled={disabled || projectId === null || create.isPending}
  {id}
  aria-invalid={ariaInvalid}
  aria-describedby={ariaDescribedBy}
  aria-label={ariaLabel}
  class={className}
/>
