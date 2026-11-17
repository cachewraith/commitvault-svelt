<!-- One toolbar action: icon button with aria-pressed state and a tooltip title. -->
<script lang="ts">
  import type { Component } from 'svelte';
  import { cn } from '$lib/utils/cn';

  interface Props {
    label: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icon: Component<any>;
    /** Toggle state; omit for plain actions (undo, insert…). */
    pressed?: boolean;
    disabled?: boolean;
    /** Keyboard shortcut hint appended to the tooltip. */
    shortcut?: string;
    onclick: () => void;
    class?: string;
  }

  let { label, icon: Icon, pressed, disabled = false, shortcut, onclick, class: className }: Props =
    $props();
</script>

<button
  type="button"
  data-toolbar-item
  tabindex="-1"
  class={cn(
    'text-muted-foreground hover:bg-muted hover:text-foreground aria-pressed:bg-accent aria-pressed:text-foreground flex size-7 shrink-0 items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-40',
    className,
  )}
  aria-label={label}
  aria-pressed={pressed}
  title={shortcut ? `${label} (${shortcut})` : label}
  {disabled}
  onmousedown={(event) => event.preventDefault()}
  {onclick}
>
  <Icon class="size-4" aria-hidden="true" />
</button>
