<!--
  Application root: providers, session gate, route guard and layout selection.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { QueryClientProvider } from '@tanstack/svelte-query';
  import LoaderIcon from '@lucide/svelte/icons/loader-circle';
  import { queryClient } from '$lib/api/query-client';
  import ErrorState from '$lib/components/ErrorState.svelte';
  import ConfirmDialogHost from '$lib/components/confirm/ConfirmDialogHost.svelte';
  import DetailSkeleton from '$lib/components/skeletons/DetailSkeleton.svelte';
  import { Toaster } from '$lib/components/ui/sonner';
  import AppShell from '$lib/layouts/AppShell.svelte';
  import AuthLayout from '$lib/layouts/AuthLayout.svelte';
  import Logo from '$lib/layouts/Logo.svelte';
  import { navigate, prefetchRoutes, router, Router, safeInternalPath, withQuery } from '$lib/router';
  import { session } from '$lib/stores/session.svelte';
  import { bootstrapSession, logout } from '$features/auth/session';
  import QuickCreateMenu from '$features/commits/components/QuickCreateMenu.svelte';
  import { routes } from './routes';

  const route = $derived(router.route);

  // Route guard: private pages need a session; guest pages (login) must not have one.
  $effect(() => {
    const current = route;
    const status = session.status;
    if (!current || status === 'loading' || status === 'error') return;

    if (current.access === 'private' && status === 'unauthenticated') {
      const target = untrack(() => router.fullPath);
      navigate(withQuery('/login', { next: target === '/' ? undefined : target }), { replace: true });
    } else if (current.access === 'guest' && status === 'authenticated') {
      const next = untrack(() => router.query.get('next'));
      navigate(safeInternalPath(next), { replace: true });
    }
  });

  /** Whether the current route may render for the current session state. */
  const allowed = $derived.by(() => {
    if (!route) return false;
    if (route.access === 'public') return true;
    if (route.access === 'private') return session.status === 'authenticated';
    return session.status === 'unauthenticated';
  });

  // Once signed in, fetch the remaining screens' code in idle time so the
  // first visit to each screen is not delayed by a chunk download.
  let prefetched = false;
  $effect(() => {
    if (session.status !== 'authenticated' || prefetched) return;
    prefetched = true;
    prefetchRoutes(routes);
  });

  const useAppShell = $derived(
    route !== null && route.layout === 'app' && session.status === 'authenticated',
  );
</script>

{#snippet quickCreate()}
  <QuickCreateMenu />
{/snippet}

{#snippet pageLoading()}
  <div class="page">
    <DetailSkeleton />
  </div>
{/snippet}

{#snippet pageFailed({ error, retry }: { error: unknown; retry: () => void })}
  <div class="page">
    <ErrorState
      {error}
      title="This page could not be loaded"
      message="The application files could not be fetched. Check your connection, or reload if a new version was just deployed."
      onretry={retry}
    />
  </div>
{/snippet}

<QueryClientProvider client={queryClient}>
  {#if session.status === 'loading'}
    <div class="flex min-h-dvh flex-col items-center justify-center gap-4" role="status" aria-live="polite">
      <Logo />
      <LoaderIcon class="text-muted-foreground size-4 animate-spin" aria-hidden="true" />
      <span class="sr-only">Loading CommitVault…</span>
    </div>
  {:else if session.status === 'error'}
    <AuthLayout>
      <div class="w-full max-w-md space-y-6">
        <div class="flex justify-center"><Logo /></div>
        <ErrorState
          title="CommitVault is unreachable"
          message={session.error ?? 'The server could not be reached.'}
          onretry={() => void bootstrapSession()}
        />
      </div>
    </AuthLayout>
  {:else if allowed}
    {#if useAppShell}
      <AppShell onlogout={logout} actions={quickCreate}>
        <Router loading={pageLoading} failed={pageFailed} />
      </AppShell>
    {:else}
      <AuthLayout>
        <Router loading={pageLoading} failed={pageFailed} />
      </AuthLayout>
    {/if}
  {/if}

  <ConfirmDialogHost />
  <Toaster position="bottom-right" closeButton />
</QueryClientProvider>
