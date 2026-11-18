<!--
  Page title block: optional breadcrumbs, title, description, and an actions
  slot aligned to the right. Use exactly one per page; it renders the <h1>.
-->
<script lang="ts" module>
  export interface Breadcrumb {
    label: string;
    /** Omit for the current page (last crumb). */
    href?: string;
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import { cn } from '$lib/utils/cn';

  interface Props {
    title: string;
    description?: string;
    breadcrumbs?: Breadcrumb[];
    /** Buttons/links rendered on the right (wraps below the title on mobile). */
    actions?: Snippet;
    /** Inline content placed next to the title (badges, status). */
    meta?: Snippet;
    /** Content below the header row (tabs, secondary nav). */
    children?: Snippet;
    class?: string;
  }

  let { title, description, breadcrumbs, actions, meta, children, class: className }: Props = $props();
</script>

<header class={cn('mb-6 flex flex-col gap-3', className)}>
  {#if breadcrumbs && breadcrumbs.length > 0}
    <nav aria-label="Breadcrumb" data-full-page>
      <ol class="text-muted-foreground flex flex-wrap items-center gap-1 text-xs">
        {#each breadcrumbs as crumb, index (index)}
          <li class="flex items-center gap-1">
            {#if index > 0}
              <ChevronRightIcon class="size-3 opacity-60" aria-hidden="true" />
            {/if}
            {#if crumb.href}
              <a href={crumb.href} class="hover:text-foreground rounded-sm transition-colors">
                {crumb.label}
              </a>
            {:else}
              <span aria-current="page" class="text-foreground max-w-[40ch] truncate">
                {crumb.label}
              </span>
            {/if}
          </li>
        {/each}
      </ol>
    </nav>
  {/if}

  <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div class="min-w-0 space-y-1">
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 class="text-foreground text-xl font-semibold tracking-tight text-balance">{title}</h1>
        {@render meta?.()}
      </div>
      {#if description}
        <p class="text-muted-foreground max-w-prose text-sm text-pretty">{description}</p>
      {/if}
    </div>
    {#if actions}
      <div class="flex shrink-0 flex-wrap items-center gap-2">
        {@render actions()}
      </div>
    {/if}
  </div>

  {@render children?.()}
</header>
