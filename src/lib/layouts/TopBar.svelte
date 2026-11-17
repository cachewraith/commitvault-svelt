<!-- Sticky top bar: mobile menu button, global search, theme toggle, profile menu. -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import LogOutIcon from '@lucide/svelte/icons/log-out';
  import MenuIcon from '@lucide/svelte/icons/menu';
  import MoonIcon from '@lucide/svelte/icons/moon';
  import SearchIcon from '@lucide/svelte/icons/search';
  import SettingsIcon from '@lucide/svelte/icons/settings';
  import SunIcon from '@lucide/svelte/icons/sun';
  import UserIcon from '@lucide/svelte/icons/circle-user';
  import { Button } from '$lib/components/ui/button';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import { toastError } from '$lib/components/toast';
  import { navigate, router } from '$lib/router';
  import { session } from '$lib/stores/session.svelte';
  import { sidebar } from '$lib/stores/sidebar.svelte';
  import { theme } from '$lib/stores/theme.svelte';
  import Logo from './Logo.svelte';

  interface Props {
    /** Ends the session (wired to the auth feature by App.svelte). */
    onlogout: () => Promise<void>;
    /** Extra controls rendered before the theme toggle (e.g. a quick-create menu). */
    actions?: Snippet;
  }

  let { onlogout, actions }: Props = $props();

  let searchInput = $state<HTMLInputElement | null>(null);
  let searchText = $state('');
  let loggingOut = $state(false);

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  // Mirror ?q= while on the search page so the box reflects the active query.
  $effect(() => {
    if (router.pathname === '/search') searchText = router.query.get('q') ?? '';
  });

  function submitSearch(event: SubmitEvent) {
    event.preventDefault();
    const q = searchText.trim();
    if (q === '') return;
    navigate(`/search?q=${encodeURIComponent(q)}`);
  }

  function isTypingTarget(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;
    if (!element) return false;
    return (
      element.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) ||
      element.getAttribute('role') === 'textbox'
    );
  }

  function onGlobalKeydown(event: KeyboardEvent) {
    const commandK = event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey) && !event.altKey;
    // Ctrl/Cmd+K is the "insert link" shortcut inside the rich-text editor.
    const slash = event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey;
    if (!(commandK || slash) || isTypingTarget(event.target)) return;
    event.preventDefault();
    searchInput?.focus();
    searchInput?.select();
  }

  async function handleLogout() {
    if (loggingOut) return;
    loggingOut = true;
    try {
      await onlogout();
    } catch (error) {
      // Local session state is cleared regardless; surface the failure only.
      toastError(error, 'Signed out locally, but the server could not be reached.');
    } finally {
      loggingOut = false;
    }
  }
</script>

<svelte:window onkeydown={onGlobalKeydown} />

<header
  class="bg-background/90 supports-backdrop-filter:bg-background/75 sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b px-3 backdrop-blur sm:px-4"
>
  <Button
    variant="ghost"
    size="icon-sm"
    class="lg:hidden"
    aria-label="Open navigation"
    aria-expanded={sidebar.mobileOpen}
    onclick={() => sidebar.openMobile()}
  >
    <MenuIcon aria-hidden="true" />
  </Button>

  <a href="/" class="mr-1 rounded-md lg:hidden" aria-label="CommitVault dashboard">
    <Logo wordmark={false} />
  </a>

  <form role="search" class="relative w-full max-w-md" onsubmit={submitSearch}>
    <label for="global-search" class="sr-only">Search everything</label>
    <SearchIcon
      class="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
      aria-hidden="true"
    />
    <input
      bind:this={searchInput}
      bind:value={searchText}
      id="global-search"
      type="text"
      inputmode="search"
      enterkeyhint="search"
      autocomplete="off"
      spellcheck="false"
      placeholder="Search commits, deployments, notes…"
      aria-keyshortcuts="/ Control+K Meta+K"
      class="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-8 w-full rounded-lg border bg-transparent pr-14 pl-8 text-sm outline-none transition-colors focus-visible:ring-3"
    />
    <kbd
      class="text-muted-foreground bg-muted pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 items-center rounded border px-1.5 font-mono text-[0.625rem] leading-4 sm:inline-flex"
      aria-hidden="true"
    >
      {isMac ? '⌘K' : 'Ctrl K'}
    </kbd>
  </form>

  <div class="ml-auto flex items-center gap-1">
    {@render actions?.()}
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={theme.isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={theme.isDark ? 'Light theme' : 'Dark theme'}
      onclick={() => theme.toggle()}
    >
      {#if theme.isDark}
        <SunIcon aria-hidden="true" />
      {:else}
        <MoonIcon aria-hidden="true" />
      {/if}
    </Button>

    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button {...props} variant="ghost" size="icon-sm" aria-label="Account menu">
            <UserIcon aria-hidden="true" />
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" class="w-60">
        <DropdownMenu.Label class="font-normal">
          <span class="text-muted-foreground block text-xs">Signed in as</span>
          <span class="text-foreground block truncate text-sm font-medium">
            {session.user?.email ?? '—'}
          </span>
        </DropdownMenu.Label>
        <DropdownMenu.Separator />
        <DropdownMenu.Item onSelect={() => navigate('/settings')}>
          <SettingsIcon aria-hidden="true" />
          Settings
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item onSelect={handleLogout} disabled={loggingOut}>
          <LogOutIcon aria-hidden="true" />
          Log out
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>
</header>
