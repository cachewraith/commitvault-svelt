<!-- Create (no `tag`) or edit a tag: name and colour. -->
<script lang="ts">
  import { untrack } from 'svelte';
  import { createMutation, useQueryClient } from '@tanstack/svelte-query';
  import { apiFieldErrors, type FieldErrors } from '$lib/api';
  import { FormField, TagBadge, toast, toastError } from '$lib/components';
  import { Button } from '$lib/components/ui/button';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { validateForm } from '$lib/validators';
  import { tagsApi } from '../api';
  import { invalidateTaggedResources, invalidateTagLists } from '../queries';
  import type { Tag } from '../types';
  import { DEFAULT_TAG_COLOR, tagFormSchema, type TagFormData } from '../validation';
  import ColorSwatchPicker from './ColorSwatchPicker.svelte';

  interface Props {
    open?: boolean;
    tag?: Tag;
    onsaved?: (tag: Tag) => void;
  }

  let { open = $bindable(false), tag, onsaved }: Props = $props();

  const queryClient = useQueryClient();
  const editing = $derived(tag !== undefined);

  let values = $state({ name: '', color: DEFAULT_TAG_COLOR });
  let errors = $state<FieldErrors>({});

  let wasOpen = false;
  $effect(() => {
    const isOpen = open;
    if (isOpen && !wasOpen) {
      const current = untrack(() => tag);
      values = { name: current?.name ?? '', color: current?.color ?? DEFAULT_TAG_COLOR };
      errors = {};
    }
    wasOpen = isOpen;
  });

  const save = createMutation(() => ({
    mutationFn: (input: { id?: string; data: TagFormData }) =>
      input.id ? tagsApi.update(input.id, input.data) : tagsApi.create(input.data),
    onSuccess: (saved, input) => {
      if (input.id) invalidateTaggedResources(queryClient);
      else invalidateTagLists(queryClient);
      toast.success(input.id ? `Tag “${saved.name}” updated` : `Tag “${saved.name}” created`);
      open = false;
      onsaved?.(saved);
    },
    onError: (error) => {
      errors = apiFieldErrors(error);
      toastError(error, 'Could not save the tag.');
    },
  }));

  function submit(event: SubmitEvent) {
    event.preventDefault();
    const result = validateForm(tagFormSchema, values);
    errors = result.errors;
    if (!result.ok) return;
    save.mutate({ id: tag?.id, data: result.data });
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>{editing ? 'Edit tag' : 'New tag'}</Dialog.Title>
      <Dialog.Description>
        {editing
          ? 'Renaming or recolouring a tag updates it on every record that uses it.'
          : 'Tags label projects, commits, deployment records, releases and notes.'}
      </Dialog.Description>
    </Dialog.Header>

    <form onsubmit={submit} novalidate class="flex flex-col gap-4">
      <FormField label="Name" error={errors.name} required>
        {#snippet children(field)}
          <Input {...field} bind:value={values.name} maxlength={50} placeholder="hotfix" disabled={save.isPending} autocomplete="off" />
        {/snippet}
      </FormField>

      <FormField label="Colour" error={errors.color} required>
        {#snippet children(field)}
          <ColorSwatchPicker
            id={field.id}
            aria-invalid={field['aria-invalid']}
            aria-describedby={field['aria-describedby']}
            bind:value={values.color}
            label="Tag colour"
            disabled={save.isPending}
          />
        {/snippet}
      </FormField>

      <div class="flex items-center gap-2 text-sm">
        <span class="text-muted-foreground">Preview</span>
        <TagBadge name={values.name.trim() || 'tag'} color={values.color.trim()} />
      </div>

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => (open = false)} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create tag'}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
