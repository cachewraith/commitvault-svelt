<!-- Create (no `branch`) or rename / describe a branch of `projectId`. -->
<script lang="ts">
  import { untrack } from 'svelte';
  import { createMutation, useQueryClient } from '@tanstack/svelte-query';
  import { apiFieldErrors, type FieldErrors } from '$lib/api';
  import { FormField, toast, toastError } from '$lib/components';
  import { Button } from '$lib/components/ui/button';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';
  import { validateForm } from '$lib/validators';
  import { branchesApi } from '../api';
  import { invalidateBranches } from '../queries';
  import type { Branch } from '../types';
  import { branchFormSchema, type BranchFormData } from '../validation';

  interface Props {
    open?: boolean;
    projectId: string;
    branch?: Pick<Branch, 'id' | 'name' | 'description' | 'commit_count'>;
    onsaved?: (branch: Branch) => void;
  }

  let { open = $bindable(false), projectId, branch, onsaved }: Props = $props();

  const queryClient = useQueryClient();
  const editing = $derived(branch !== undefined);

  let values = $state({ name: '', description: '' });
  let errors = $state<FieldErrors>({});

  // Reset when the dialog opens, never while it is open (keeps input on failure).
  let wasOpen = false;
  $effect(() => {
    const isOpen = open;
    if (isOpen && !wasOpen) {
      untrack(() => {
        values = { name: branch?.name ?? '', description: branch?.description ?? '' };
      });
      errors = {};
    }
    wasOpen = isOpen;
  });

  const save = createMutation(() => ({
    mutationFn: (input: { id?: string; data: BranchFormData }) =>
      input.id ? branchesApi.update(input.id, input.data) : branchesApi.create(projectId, input.data),
    onSuccess: (saved: Branch, input) => {
      invalidateBranches(queryClient);
      toast.success(input.id ? `Branch “${saved.name}” saved` : `Branch “${saved.name}” created`);
      open = false;
      onsaved?.(saved);
    },
    onError: (error: unknown) => {
      // 422 and the duplicate-name 409 are shown next to the field.
      errors = apiFieldErrors(error);
      toastError(error, 'Could not save the branch.');
    },
  }));

  const renaming = $derived(editing && values.name.trim() !== branch?.name);

  function submit(event: SubmitEvent) {
    event.preventDefault();
    const result = validateForm(branchFormSchema, values);
    errors = result.errors;
    if (!result.ok) return;
    save.mutate({ id: branch?.id, data: result.data });
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>{editing ? 'Edit branch' : 'New branch'}</Dialog.Title>
      <Dialog.Description>
        Commits are recorded on a branch of their project.
      </Dialog.Description>
    </Dialog.Header>

    <form onsubmit={submit} novalidate class="flex flex-col gap-4">
      <FormField
        label="Name"
        error={errors.name}
        hint={renaming && branch && branch.commit_count > 0
          ? `Its ${branch.commit_count === 1 ? 'commit moves' : `${branch.commit_count} commits move`} with it.`
          : undefined}
        required
      >
        {#snippet children(field)}
          <Input
            {...field}
            bind:value={values.name}
            maxlength={255}
            class="font-mono"
            placeholder="e.g. feature/checkout"
            disabled={save.isPending}
            autocomplete="off"
            autocapitalize="none"
            spellcheck="false"
          />
        {/snippet}
      </FormField>

      <FormField label="Description" error={errors.description} optional>
        {#snippet children(field)}
          <Textarea
            {...field}
            bind:value={values.description}
            rows={3}
            maxlength={2000}
            placeholder="What this branch is for."
            disabled={save.isPending}
          />
        {/snippet}
      </FormField>

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => (open = false)} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create branch'}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
