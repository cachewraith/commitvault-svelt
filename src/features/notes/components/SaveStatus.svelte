<!--
  Visible autosave status for the note editor. The text lives in a polite live
  region so screen readers hear "Saving…" / "Saved 12:04" / "Save failed".
-->
<script lang="ts">
  import CheckIcon from '@lucide/svelte/icons/check';
  import CircleDotIcon from '@lucide/svelte/icons/circle-dot';
  import LoaderIcon from '@lucide/svelte/icons/loader-circle';
  import AlertIcon from '@lucide/svelte/icons/triangle-exclamation-point';
  import { Button } from '$lib/components/ui/button';
  import { cn } from '$lib/utils/cn';
  import type { SaveStatus } from '../autosave.svelte';

  interface Props {
    status: SaveStatus;
    savedAt?: Date | null;
    /** Shown instead of the default text while `status` is `saved` and nothing was saved yet. */
    idleText?: string;
    /** Why autosave is paused (status `invalid`). */
    invalidText?: string;
    onretry?: () => void;
    class?: string;
  }

  let {
    status,
    savedAt = null,
    idleText = 'All changes saved',
    invalidText = 'Not saved — fix the highlighted field',
    onretry,
    class: className,
  }: Props = $props();

  const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

  const text = $derived.by(() => {
    switch (status) {
      case 'dirty':
        return 'Unsaved changes';
      case 'saving':
        return 'Saving…';
      case 'error':
        return 'Save failed';
      case 'invalid':
        return invalidText;
      default:
        return savedAt ? `Saved ${time.format(savedAt)}` : idleText;
    }
  });
</script>

<span class={cn('inline-flex items-center gap-1.5 text-xs', className)}>
  <span
    role="status"
    aria-live="polite"
    class={cn(
      'inline-flex items-center gap-1.5',
      status === 'error' ? 'text-danger' : status === 'invalid' ? 'text-warning' : 'text-muted-foreground',
    )}
  >
    {#if status === 'saving'}
      <LoaderIcon class="size-3.5 animate-spin" aria-hidden="true" />
    {:else if status === 'error' || status === 'invalid'}
      <AlertIcon class="size-3.5" aria-hidden="true" />
    {:else if status === 'dirty'}
      <CircleDotIcon class="size-3.5" aria-hidden="true" />
    {:else}
      <CheckIcon class="size-3.5" aria-hidden="true" />
    {/if}
    {text}
  </span>
  {#if status === 'error' && onretry}
    <Button variant="outline" size="xs" onclick={onretry}>Retry</Button>
  {/if}
</span>
