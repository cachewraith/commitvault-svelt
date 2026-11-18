<script lang="ts">
  import type { Component, Snippet } from 'svelte';
  import type { Tone } from '$lib/types';
  import { cn } from '$lib/utils/cn';

  interface Props {
    /** Colours the marker. Use the deployment status tone. */
    tone?: Tone;
    /** Icon inside the marker; a plain dot is drawn when omitted. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icon?: Component<any>;
    /** Heading line. */
    title: Snippet;
    /** Right-aligned metadata (timestamp, status). */
    meta?: Snippet;
    /** Body content under the heading. */
    children?: Snippet;
    class?: string;
  }

  let { tone = 'neutral', icon: Icon, title, meta, children, class: className }: Props = $props();

  const markerClasses: Record<Tone, string> = {
    success: 'border-success/40 bg-success/10 text-success',
    danger: 'border-danger/40 bg-danger/10 text-danger',
    warning: 'border-warning/40 bg-warning/10 text-warning',
    info: 'border-info/40 bg-info/10 text-info',
    neutral: 'border-border bg-muted text-muted-foreground',
  };

  const dotClasses: Record<Tone, string> = {
    success: 'bg-success',
    danger: 'bg-danger',
    warning: 'bg-warning',
    info: 'bg-info',
    neutral: 'bg-neutral',
  };
</script>

<li class={cn('animate-enter group/timeline relative flex gap-3 pb-6 last:pb-0', className)}>
  <!-- connector line -->
  <span
    class="bg-border absolute top-6 bottom-0 left-3 w-px -translate-x-1/2 group-last/timeline:hidden"
    aria-hidden="true"
  ></span>

  <span
    class={cn(
      'bg-background relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border',
      markerClasses[tone],
    )}
    aria-hidden="true"
  >
    {#if Icon}
      <Icon class="size-3" />
    {:else}
      <span class={cn('size-1.5 rounded-full', dotClasses[tone])}></span>
    {/if}
  </span>

  <div class="min-w-0 flex-1 pt-0.5">
    <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
      <div class="text-foreground min-w-0 text-sm font-medium">{@render title()}</div>
      {#if meta}
        <div class="text-muted-foreground flex shrink-0 items-center gap-2 text-xs">
          {@render meta()}
        </div>
      {/if}
    </div>
    {#if children}
      <div class="text-muted-foreground mt-1.5 text-sm">
        {@render children()}
      </div>
    {/if}
  </div>
</li>
