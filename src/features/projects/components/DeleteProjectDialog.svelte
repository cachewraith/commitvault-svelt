<!--
  Type-the-name confirmation for deleting a project. Deleting cascades to
  everything the project owns, so the dialog spells that out.
-->
<script lang="ts">
  import { createMutation, useQueryClient } from '@tanstack/svelte-query';
  import { FormField, toast, toastError } from '$lib/components';
  import { Button } from '$lib/components/ui/button';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { projectsApi } from '../api';
  import { describeProjectContents } from '../queries';
  import type { Project } from '../types';

  interface Props {
    open?: boolean;
    project: Project;
    ondeleted?: () => void;
  }

  let { open = $bindable(false), project, ondeleted }: Props = $props();

  const queryClient = useQueryClient();

  let typed = $state('');
  $effect(() => {
    if (!open) typed = '';
  });

  const contents = $derived(describeProjectContents(project));
  const matches = $derived(typed.trim() === project.name);

  const remove = createMutation(() => ({
    mutationFn: () => projectsApi.remove(project.id),
    onSuccess: () => {
      toast.success(`Project “${project.name}” deleted`);
      open = false;
      ondeleted?.();
      // Everything cached may reference the project — except its own record,
      // which no longer exists and must not be refetched by the page we are leaving.
      void queryClient.invalidateQueries({
        predicate: (query) =>
          !(query.queryKey[0] === 'projects' && query.queryKey[1] === 'detail' && query.queryKey[2] === project.id),
      });
    },
    onError: (error) => toastError(error, 'Could not delete the project.'),
  }));

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (matches && !remove.isPending) remove.mutate();
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>Delete project “{project.name}”?</Dialog.Title>
      <Dialog.Description>
        {#if contents}
          This permanently deletes the project together with its {contents}.
        {:else}
          This permanently deletes the project. It has no recorded data yet.
        {/if}
        This cannot be undone.
      </Dialog.Description>
    </Dialog.Header>

    <form onsubmit={submit} novalidate class="flex flex-col gap-4">
      <FormField label={`Type “${project.name}” to confirm`}>
        {#snippet children(field)}
          <Input {...field} bind:value={typed} autocomplete="off" autocapitalize="none" spellcheck="false" />
        {/snippet}
      </FormField>

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => (open = false)} disabled={remove.isPending}>
          Cancel
        </Button>
        <Button type="submit" variant="destructive" disabled={!matches || remove.isPending}>
          {remove.isPending ? 'Deleting…' : 'Delete project'}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
