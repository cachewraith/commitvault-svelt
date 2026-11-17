<!--
  Status pill for deployments (successful | failed | rolled_back | pending),
  releases (draft | released | deprecated) and projects (active | archived).
  Colour is never the only signal: the label is always rendered.
-->
<script lang="ts">
  import type { AnyStatus } from '$lib/types';
  import { cn } from '$lib/utils/cn';
  import { statusPresentation, TONE_CLASSES } from './status';

  interface Props {
    status: AnyStatus | (string & {});
    /** `dot` renders only a coloured dot + label without the pill chrome. */
    variant?: 'badge' | 'dot';
    class?: string;
  }

  let { status, variant = 'badge', class: className }: Props = $props();

  const presentation = $derived(statusPresentation(status));
  const tone = $derived(TONE_CLASSES[presentation.tone]);
</script>

{#if variant === 'dot'}
  <span class={cn('inline-flex items-center gap-1.5 text-xs font-medium', tone.text, className)}>
    <span class={cn('size-1.5 rounded-full', tone.dot)} aria-hidden="true"></span>
    {presentation.label}
  </span>
{:else}
  <span
    class={cn(
      'inline-flex h-5 items-center gap-1.5 rounded-full border px-2 align-middle text-xs font-medium whitespace-nowrap',
      tone.badge,
      className,
    )}
  >
    <span class={cn('size-1.5 rounded-full', tone.dot)} aria-hidden="true"></span>
    {presentation.label}
  </span>
{/if}
