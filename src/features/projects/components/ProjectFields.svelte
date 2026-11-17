<!-- The project form's controls, shared by the create/edit dialog and the settings page. -->
<script lang="ts">
  import type { FieldErrors } from '$lib/api';
  import { FormField } from '$lib/components';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';
  import { slugify } from '$lib/utils';
  import TagPicker from '$features/tags/components/TagPicker.svelte';
  import type { TagRef } from '$features/tags/types';
  import type { ProjectFormValues } from '../form';

  interface Props {
    values: ProjectFormValues;
    errors: FieldErrors;
    /** `create`: the slug is optional and previews the generated value. */
    mode: 'create' | 'edit';
    /** Tags already attached (labels for the picker). */
    selectedTags?: TagRef[];
    /** Slug before editing; changing it shows a warning. */
    originalSlug?: string;
    disabled?: boolean;
  }

  let {
    values = $bindable(),
    errors,
    mode,
    selectedTags = [],
    originalSlug,
    disabled = false,
  }: Props = $props();

  const slugPreview = $derived(slugify(values.name));
  const slugChanged = $derived(
    mode === 'edit' && originalSlug !== undefined && values.slug.trim().toLowerCase() !== originalSlug,
  );
</script>

<FormField label="Name" error={errors.name} required>
  {#snippet children(field)}
    <Input {...field} bind:value={values.name} maxlength={120} placeholder="Billing API" {disabled} autocomplete="off" />
  {/snippet}
</FormField>

<FormField
  label="Slug"
  error={errors.slug}
  required={mode === 'edit'}
  optional={mode === 'create'}
  hint={mode === 'create'
    ? slugPreview
      ? `Leave blank to use “${slugPreview}”.`
      : 'Leave blank to generate it from the name.'
    : slugChanged
      ? 'Changing the slug changes how the project is identified in exports and search.'
      : 'Lowercase letters, digits and hyphens.'}
>
  {#snippet children(field)}
    <Input
      {...field}
      bind:value={values.slug}
      maxlength={140}
      class="font-mono"
      placeholder={slugPreview || 'billing-api'}
      {disabled}
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
      maxlength={5000}
      placeholder="What this project is and anything worth remembering about it."
      {disabled}
    />
  {/snippet}
</FormField>

<div class="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
  <FormField label="Repository URL" error={errors.repository_url} optional>
    {#snippet children(field)}
      <Input
        {...field}
        type="url"
        bind:value={values.repository_url}
        maxlength={2048}
        placeholder="https://github.com/acme/billing"
        {disabled}
        autocomplete="off"
        autocapitalize="none"
        spellcheck="false"
      />
    {/snippet}
  </FormField>

  <FormField label="Default branch" error={errors.default_branch} required>
    {#snippet children(field)}
      <Input
        {...field}
        bind:value={values.default_branch}
        maxlength={255}
        class="font-mono"
        placeholder="main"
        {disabled}
        autocomplete="off"
        autocapitalize="none"
        spellcheck="false"
      />
    {/snippet}
  </FormField>
</div>

<FormField label="Tags" error={errors.tag_ids} optional>
  {#snippet children(field)}
    <TagPicker
      id={field.id}
      aria-invalid={field['aria-invalid']}
      aria-describedby={field['aria-describedby']}
      bind:values={values.tag_ids}
      selected={selectedTags}
      {disabled}
    />
  {/snippet}
</FormField>
