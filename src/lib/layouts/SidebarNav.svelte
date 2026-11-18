<!-- Navigation list shared by the desktop sidebar and the mobile drawer. -->
<script lang="ts">
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { router } from '$lib/router';
  import { cn } from '$lib/utils/cn';
  import { isNavItemActive, NAV_SECTIONS, SECONDARY_NAV, type NavItem } from './navigation';

  interface Props {
    /** Icon-only rail (desktop collapsed state). */
    collapsed?: boolean;
    /** Called after a link is activated (closes the mobile drawer). */
    onnavigate?: () => void;
  }

  let { collapsed = false, onnavigate }: Props = $props();
</script>

{#snippet link(item: NavItem, triggerProps: Record<string, unknown> = {})}
  {@const active = isNavItemActive(item, router.pathname)}
  {@const Icon = item.icon}
  <a
    href={item.href}
    aria-current={active ? 'page' : undefined}
    aria-label={collapsed ? item.label : undefined}
    class={cn(
      'group text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground relative flex h-8 items-center gap-2.5 rounded-md text-sm font-medium transition-colors',
      collapsed ? 'w-8 justify-center' : 'px-2.5',
      active && 'bg-sidebar-accent text-sidebar-accent-foreground',
    )}
    onclick={onnavigate}
    {...triggerProps}
  >
    {#if active}
      <span
        class="bg-brand absolute top-1.5 bottom-1.5 -left-2 w-0.5 rounded-full"
        aria-hidden="true"
      ></span>
    {/if}
    <Icon
      class={cn('size-4 shrink-0', active ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground')}
      aria-hidden="true"
    />
    {#if !collapsed}
      <span class="truncate">{item.label}</span>
    {/if}
  </a>
{/snippet}

{#snippet entry(item: NavItem)}
  <li>
    {#if collapsed}
      <Tooltip.Root>
        <Tooltip.Trigger>
          {#snippet child({ props })}
            {@render link(item, props)}
          {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content side="right">{item.label}</Tooltip.Content>
      </Tooltip.Root>
    {:else}
      {@render link(item)}
    {/if}
  </li>
{/snippet}

<nav aria-label="Main" class="flex min-h-0 flex-1 flex-col justify-between gap-4 overflow-y-auto px-2 py-3">
  <div class="flex flex-col gap-4">
    {#each NAV_SECTIONS as section, index (index)}
      <div class="flex flex-col gap-1">
        {#if section.label}
          {#if collapsed}
            <span class="bg-sidebar-border mx-auto h-px w-5" aria-hidden="true"></span>
          {:else}
            <span class="text-muted-foreground/80 px-2.5 text-[0.6875rem] font-medium">{section.label}</span>
          {/if}
        {/if}
        <ul
          class={cn('flex flex-col gap-0.5', collapsed && 'items-center')}
          aria-label={section.label ?? 'Workspace'}
        >
          {#each section.items as item (item.href)}
            {@render entry(item)}
          {/each}
        </ul>
      </div>
    {/each}
  </div>
  <ul class={cn('flex flex-col gap-0.5', collapsed && 'items-center')}>
    {#each SECONDARY_NAV as item (item.href)}
      {@render entry(item)}
    {/each}
  </ul>
</nav>
