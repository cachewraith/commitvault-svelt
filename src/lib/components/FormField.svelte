<!--
  Label + control + hint/error with correct ARIA wiring.

    <FormField label="Name" error={errors.name} required>
      {#snippet children(field)}
        <Input {...field} bind:value={values.name} />
      {/snippet}
    </FormField>

  Spread `field` onto the control: it carries `id`, `aria-invalid`,
  `aria-describedby` and `aria-required`.
-->
<script lang="ts" module>
  export interface FieldControlProps {
    id: string;
    'aria-invalid': 'true' | undefined;
    'aria-describedby': string | undefined;
    'aria-required': 'true' | undefined;
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  interface Props {
    label: string;
    /** Validation message; when set the control is marked invalid. */
    error?: string | null;
    /** Helper text shown under the control. */
    hint?: string;
    required?: boolean;
    /** Marks the field as optional next to the label. */
    optional?: boolean;
    /** Visually hide the label (still announced). */
    hideLabel?: boolean;
    /** Extra content on the label row, right-aligned (e.g. a counter or link). */
    labelAside?: Snippet;
    children: Snippet<[FieldControlProps]>;
    class?: string;
  }

  let {
    label,
    error = null,
    hint,
    required = false,
    optional = false,
    hideLabel = false,
    labelAside,
    children,
    class: className,
  }: Props = $props();

  const uid = $props.id();
  const id = `${uid}-control`;
  const hintId = `${uid}-hint`;
  const errorId = `${uid}-error`;

  const describedBy = $derived(
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined,
  );

  const control = $derived<FieldControlProps>({
    id,
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': describedBy,
    'aria-required': required ? 'true' : undefined,
  });
</script>

<div class={cn('flex flex-col gap-1.5', className)}>
  <div class={cn('flex items-baseline justify-between gap-2', hideLabel && !labelAside && 'sr-only')}>
    <label for={id} class={cn('text-foreground text-sm font-medium', hideLabel && 'sr-only')}>
      {label}
      {#if required}
        <span class="text-danger" aria-hidden="true">*</span>
      {:else if optional}
        <span class="text-muted-foreground font-normal">(optional)</span>
      {/if}
    </label>
    {@render labelAside?.()}
  </div>

  {@render children(control)}

  {#if error}
    <p id={errorId} class="text-danger text-xs" role="alert">{error}</p>
  {/if}
  {#if hint}
    <p id={hintId} class="text-muted-foreground text-xs">{hint}</p>
  {/if}
</div>
