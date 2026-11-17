<!--
  Authenticated application frame: collapsible sidebar (drawer on mobile),
  sticky top bar and the main content region. Pages render inside <main> and
  wrap their content in `<div class="page">`.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import PanelLeftCloseIcon from '@lucide/svelte/icons/panel-left-close';
  import PanelLeftOpenIcon from '@lucide/svelte/icons/panel-left-open';
  import { Button } from '$lib/components/ui/button';
  import * as Sheet from '$lib/components/ui/sheet';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { router } from '$lib/router';
  import { sidebar } from '$lib/stores/sidebar.svelte';
  import { cn } from '$lib/utils/cn';
  import Logo from './Logo.svelte';
  import SidebarNav from './SidebarNav.svelte';
  import TopBar from './TopBar.svelte';

  interface Props {
    children: Snippet;
    /** Ends the session; passed through to the profile menu. */
    onlogout: () => Promise<void>;
    /** Extra top-bar controls; passed through to `TopBar`. */
    actions?: Snippet;
  }

  let { children, onlogout, actions }: Props = $props();

  let main = $state<HTMLElement | null>(null);

  // Close the mobile drawer and move focus to the content after each navigation,
  // so keyboard and screen-reader users land on the new page.
  let previousPath = router.pathname;
  $effect(() => {
    const path = router.pathname;
    if (path === previousPath) return;
    previousPath = path;
    sidebar.closeMobile();
    main?.focus({ preventScroll: true });
  });

  function skipToContent(event: MouseEvent) {
    event.preventDefault();
    main?.focus();
    main?.scrollIntoView();
  }
</script>

<a
  href="#main-content"
  data-native
  class="bg-primary text-primary-foreground sr-only z-50 rounded-md px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
  onclick={skipToContent}
>
  Skip to content
</a>

<Tooltip.Provider delayDuration={300}>
  <div class="flex min-h-dvh" style="--header-height: 3rem">
    <!-- Desktop sidebar -->
    <aside
      class={cn(
        'bg-sidebar sticky top-0 hidden h-dvh shrink-0 flex-col border-r transition-[width] duration-150 lg:flex',
        sidebar.collapsed ? 'w-14' : 'w-56',
      )}
      aria-label="Sidebar"
    >
      <div
        class={cn(
          'flex h-12 shrink-0 items-center border-b',
          sidebar.collapsed ? 'justify-center' : 'px-4',
        )}
      >
        <a href="/" class="rounded-md" aria-label="CommitVault dashboard">
          <Logo wordmark={!sidebar.collapsed} />
        </a>
      </div>

      <SidebarNav collapsed={sidebar.collapsed} />

      <div class={cn('border-t p-2', sidebar.collapsed && 'flex justify-center')}>
        <Button
          variant="ghost"
          size={sidebar.collapsed ? 'icon-sm' : 'sm'}
          class={cn('text-muted-foreground', !sidebar.collapsed && 'w-full justify-start gap-2.5 px-2.5')}
          aria-label={sidebar.collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onclick={() => sidebar.toggleCollapsed()}
        >
          {#if sidebar.collapsed}
            <PanelLeftOpenIcon aria-hidden="true" />
          {:else}
            <PanelLeftCloseIcon aria-hidden="true" />
            <span>Collapse</span>
          {/if}
        </Button>
      </div>
    </aside>

    <!-- Mobile drawer -->
    <Sheet.Root bind:open={sidebar.mobileOpen}>
      <Sheet.Content side="left" class="bg-sidebar w-64 gap-0 p-0 lg:hidden">
        <Sheet.Header class="flex h-12 flex-row items-center border-b px-4 py-0">
          <Sheet.Title class="sr-only">Navigation</Sheet.Title>
          <Sheet.Description class="sr-only">Main navigation links</Sheet.Description>
          <Logo />
        </Sheet.Header>
        <SidebarNav onnavigate={() => sidebar.closeMobile()} />
      </Sheet.Content>
    </Sheet.Root>

    <div class="flex min-w-0 flex-1 flex-col">
      <TopBar {onlogout} {actions} />
      <main
        bind:this={main}
        id="main-content"
        tabindex="-1"
        class="flex-1 outline-none"
      >
        {@render children()}
      </main>
    </div>
  </div>
</Tooltip.Provider>
