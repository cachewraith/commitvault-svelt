<!--
  Create (no `project`) or edit a project in a dialog.

    <ProjectFormDialog bind:open onsaved={(project) => navigate(paths.project(project.id))} />
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { createMutation, useQueryClient } from '@tanstack/svelte-query';
  import { apiFieldErrors, type FieldErrors } from '$lib/api';
  import { toast, toastError } from '$lib/components';
  import { Button } from '$lib/components/ui/button';
  import * as Dialog from '$lib/components/ui/dialog';
  import { validateForm } from '$lib/validators';
  import { projectsApi } from '../api';
  import { projectFormValues, type ProjectFormValues } from '../form';
  import { invalidateProjects } from '../queries';
  import type { Project } from '../types';
  import {
    projectCreateSchema,
    projectUpdateSchema,
    type ProjectCreateData,
    type ProjectUpdateData,
  } from '../validation';
  import ProjectFields from './ProjectFields.svelte';

  interface Props {
    open?: boolean;
    project?: Project;
    onsaved?: (project: Project) => void;
  }

  let { open = $bindable(false), project, onsaved }: Props = $props();

  const queryClient = useQueryClient();
  const editing = $derived(project !== undefined);

  let values = $state<ProjectFormValues>(projectFormValues());
  let errors = $state<FieldErrors>({});

  // Start from a clean form each time the dialog opens — never while it is
  // open, so a failed submit keeps what the user typed.
  let wasOpen = false;
  $effect(() => {
    const isOpen = open;
    if (isOpen && !wasOpen) {
      values = projectFormValues(untrack(() => project));
      errors = {};
    }
    wasOpen = isOpen;
  });

  type SaveInput =
    | { id: string; data: ProjectUpdateData }
    | { id?: undefined; data: ProjectCreateData };

  const save = createMutation(() => ({
    mutationFn: (input: SaveInput) =>
      input.id === undefined ? projectsApi.create(input.data) : projectsApi.update(input.id, input.data),
    onSuccess: (saved, input) => {
      invalidateProjects(queryClient);
      toast.success(input.id ? `Project “${saved.name}” updated` : `Project “${saved.name}” created`);
      open = false;
      onsaved?.(saved);
    },
    onError: (error) => {
      // 422 and attributable 409s (duplicate slug) land next to their fields.
      errors = apiFieldErrors(error);
      toastError(error, 'Could not save the project.');
    },
  }));

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (project) {
      const result = validateForm(projectUpdateSchema, values);
      errors = result.errors;
      if (result.ok) save.mutate({ id: project.id, data: result.data });
    } else {
      const result = validateForm(projectCreateSchema, values);
      errors = result.errors;
      if (result.ok) save.mutate({ data: result.data });
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
    <Dialog.Header>
      <Dialog.Title>{editing ? 'Edit project' : 'New project'}</Dialog.Title>
      <Dialog.Description>
        {editing
          ? 'Update the project’s details.'
          : 'A project groups its commits, environments, deployment records, releases and notes.'}
      </Dialog.Description>
    </Dialog.Header>

    <form onsubmit={submit} novalidate class="flex flex-col gap-4">
      <ProjectFields
        bind:values
        {errors}
        mode={editing ? 'edit' : 'create'}
        selectedTags={project?.tags}
        originalSlug={project?.slug}
        disabled={save.isPending}
      />

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => (open = false)} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create project'}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
