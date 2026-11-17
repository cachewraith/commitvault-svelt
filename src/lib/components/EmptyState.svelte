<!--
  Placeholder for "nothing here yet" and "no results" situations.
  Always offer the next step through the `action` snippet when one exists.
-->
<script lang="ts">
  import type { Component, Snippet } from 'svelte';
  import InboxIcon from '@lucide/svelte/icons/inbox';
  import { cn } from '$lib/utils/cn';

  interface Props {
    title: string;
    description?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icon?: Component<any>;
    /** Primary call to action (button or link). */
    action?: Snippet;
    /** Tighter padding for use inside cards and table bodies. */
    compact?: boolean;
    /** Draw a dashed border (default) — disable when already inside a bordered card. */
    bordered?: boolean;
    class?: string;
  }

  let {
    title,
    description,
    icon: Icon = InboxIcon,
    action,
    compact = false,
    bordered = true,
    class: className,
  }: Props = $props();
</script>

<div
  class={cn(
    'flex flex-col items-center justify-center text-center',
    compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-14',
    bordered && 'rounded-lg border border-dashed',
    className,
  )}
>
  <div
    class={cn(
      'bg-muted text-muted-foreground flex items-center justify-center rounded-lg border',
      compact ? 'size-8' : 'size-10',
    )}
    aria-hidden="true"
  >
    <Icon class={compact ? 'size-4' : 'size-5'} />
  </div>
  <div class="space-y-1">
    <p class="text-foreground text-sm font-medium">{title}</p>
    {#if description}
      <p class="text-muted-foreground mx-auto max-w-sm text-sm text-pretty">{description}</p>
    {/if}
  </div>
  {#if action}
    <div class="mt-1 flex flex-wrap items-center justify-center gap-2">
      {@render action()}
    </div>
  {/if}
</div>
