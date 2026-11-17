<!--
  Create (no `environment`) or edit an environment of `projectId`.
  `suggestedName` pre-fills the name when creating (quick-add buttons).
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { createMutation, useQueryClient } from '@tanstack/svelte-query';
  import { apiFieldErrors, type FieldErrors } from '$lib/api';
  import { EnvironmentBadge, FormField, toast, toastError } from '$lib/components';
  import { Button } from '$lib/components/ui/button';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';
  import { validateForm } from '$lib/validators';
  import ColorSwatchPicker from '$features/tags/components/ColorSwatchPicker.svelte';
  import { environmentsApi } from '../api';
  import { invalidateEnvironments } from '../queries';
  import type { Environment } from '../types';
  import { DEFAULT_ENVIRONMENT_COLOR, environmentFormSchema, type EnvironmentFormData } from '../validation';

  interface Props {
    open?: boolean;
    projectId: string;
    environment?: Environment;
    onsaved?: (environment: Environment) => void;
    /** Initial name and colour for a new environment. */
    suggestedName?: string;
    suggestedColor?: string;
  }

  let {
    open = $bindable(false),
    projectId,
    environment,
    onsaved,
    suggestedName,
    suggestedColor,
  }: Props = $props();

  const queryClient = useQueryClient();
  const editing = $derived(environment !== undefined);

  let values = $state({ name: '', description: '', color: DEFAULT_ENVIRONMENT_COLOR, server_label: '' });
  let errors = $state<FieldErrors>({});

  // Reset when the dialog opens, never while it is open (keeps input on failure).
  let wasOpen = false;
  $effect(() => {
    const isOpen = open;
    if (isOpen && !wasOpen) {
      untrack(() => {
        values = {
          name: environment?.name ?? suggestedName ?? '',
          description: environment?.description ?? '',
          color: environment?.color ?? suggestedColor ?? DEFAULT_ENVIRONMENT_COLOR,
          server_label: environment?.server_label ?? '',
        };
      });
      errors = {};
    }
    wasOpen = isOpen;
  });

  const save = createMutation(() => ({
    mutationFn: (input: { id?: string; data: EnvironmentFormData }) =>
      input.id ? environmentsApi.update(input.id, input.data) : environmentsApi.create(projectId, input.data),
    onSuccess: (saved, input) => {
      invalidateEnvironments(queryClient);
      toast.success(input.id ? `Environment “${saved.name}” updated` : `Environment “${saved.name}” created`);
      open = false;
      onsaved?.(saved);
    },
    onError: (error) => {
      // 422 and the duplicate-name 409 are shown next to the field.
      errors = apiFieldErrors(error);
      toastError(error, 'Could not save the environment.');
    },
  }));

  function submit(event: SubmitEvent) {
    event.preventDefault();
    const result = validateForm(environmentFormSchema, values);
    errors = result.errors;
    if (!result.ok) return;
    save.mutate({ id: environment?.id, data: result.data });
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>{editing ? 'Edit environment' : 'New environment'}</Dialog.Title>
      <Dialog.Description>
        An environment is a place this project gets deployed to — name it whatever you call it.
      </Dialog.Description>
    </Dialog.Header>

    <form onsubmit={submit} novalidate class="flex flex-col gap-4">
      <FormField label="Name" error={errors.name} required>
        {#snippet children(field)}
          <Input {...field} bind:value={values.name} maxlength={80} placeholder="e.g. Staging" disabled={save.isPending} autocomplete="off" />
        {/snippet}
      </FormField>

      <FormField label="Colour" error={errors.color} required>
        {#snippet children(field)}
          <ColorSwatchPicker
            id={field.id}
            aria-invalid={field['aria-invalid']}
            aria-describedby={field['aria-describedby']}
            bind:value={values.color}
            label="Environment colour"
            disabled={save.isPending}
          />
        {/snippet}
      </FormField>

      <FormField
        label="Server label"
        error={errors.server_label}
        optional
        hint="A free-form reminder of where it runs, e.g. vps-eu-1. Nothing connects to it."
      >
        {#snippet children(field)}
          <Input
            {...field}
            bind:value={values.server_label}
            maxlength={120}
            class="font-mono"
            placeholder="vps-eu-1"
            disabled={save.isPending}
            autocomplete="off"
            autocapitalize="none"
            spellcheck="false"
          />
        {/snippet}
      </FormField>

      <FormField label="Description" error={errors.description} optional>
        {#snippet children(field)}
          <Textarea {...field} bind:value={values.description} rows={2} maxlength={2000} disabled={save.isPending} />
        {/snippet}
      </FormField>

      <div class="flex items-center gap-2 text-sm">
        <span class="text-muted-foreground">Preview</span>
        <EnvironmentBadge name={values.name.trim() || 'Environment'} color={values.color.trim()} />
      </div>

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => (open = false)} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create environment'}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
