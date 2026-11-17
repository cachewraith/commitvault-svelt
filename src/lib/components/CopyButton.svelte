<!--
  Icon button that copies `value` to the clipboard and confirms with a
  check mark for ~1.5 s (also announced to screen readers).
-->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import CheckIcon from '@lucide/svelte/icons/check';
  import CopyIcon from '@lucide/svelte/icons/copy';
  import { Button, type ButtonSize, type ButtonVariant } from '$lib/components/ui/button';
  import { copyToClipboard } from '$lib/utils/clipboard';
  import { cn } from '$lib/utils/cn';
  import { toast } from '$lib/components/toast';

  interface Props {
    value: string;
    /** Accessible name, e.g. "Copy commit hash". */
    label?: string;
    /** Optional visible text next to the icon. */
    text?: string;
    variant?: ButtonVariant;
    size?: ButtonSize;
    class?: string;
    oncopied?: () => void;
  }

  let {
    value,
    label = 'Copy to clipboard',
    text,
    variant = 'ghost',
    size,
    class: className,
    oncopied,
  }: Props = $props();

  let copied = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function copy(event: MouseEvent) {
    // Copy buttons often sit inside clickable rows/links.
    event.preventDefault();
    event.stopPropagation();
    const ok = await copyToClipboard(value);
    if (!ok) {
      toast.error('Could not copy to the clipboard.');
      return;
    }
    copied = true;
    oncopied?.();
    clearTimeout(timer);
    timer = setTimeout(() => (copied = false), 1500);
  }

  onDestroy(() => clearTimeout(timer));
</script>

<Button
  {variant}
  size={size ?? (text ? 'sm' : 'icon-xs')}
  class={cn('text-muted-foreground hover:text-foreground', className)}
  aria-label={text ? undefined : copied ? 'Copied' : label}
  title={copied ? 'Copied' : label}
  onclick={copy}
>
  {#if copied}
    <CheckIcon class="text-success" aria-hidden="true" />
  {:else}
    <CopyIcon aria-hidden="true" />
  {/if}
  {#if text}<span>{copied ? 'Copied' : text}</span>{/if}
  <span class="sr-only" aria-live="polite">{copied ? 'Copied to clipboard' : ''}</span>
</Button>
