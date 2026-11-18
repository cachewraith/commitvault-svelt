<!--
  Renders the page for the current route.

  - Page modules are loaded lazily (one chunk per route); once loaded they are
    kept in memory so revisiting a route renders synchronously.
  - Route `:params` are spread onto the page as props:
      /projects/:projectId  →  let { projectId }: { projectId: string } = $props();
  - The page is re-created whenever the pathname changes, so component state
    never leaks between two records of the same route. Query-string changes do
    not remount the page.
-->
<script lang="ts">
  import type { Component, Snippet } from 'svelte';
  import { router, type ResolvedRoute } from './router.svelte';

  interface Props {
    /** Shown while a page chunk is loading. */
    loading?: Snippet;
    /** Shown when a page chunk fails to load (offline, stale deploy). */
    failed?: Snippet<[{ error: unknown; retry: () => void }]>;
  }

  let { loading, failed }: Props = $props();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyComponent = Component<any>;

  const loaded = new Map<ResolvedRoute, AnyComponent>();
  let version = $state(0);
  let failure = $state.raw<{ route: ResolvedRoute; error: unknown } | null>(null);
  let attempt = $state(0);

  const Page = $derived.by(() => {
    void version;
    return router.route ? (loaded.get(router.route) ?? null) : null;
  });

  $effect(() => {
    const route = router.route;
    void attempt;
    if (!route || loaded.has(route)) return;

    let cancelled = false;
    route
      .load()
      .then((module) => {
        loaded.set(route, module.default);
        if (!cancelled) {
          failure = null;
          version++;
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) failure = { route, error };
      });

    return () => {
      cancelled = true;
    };
  });

  function retry() {
    failure = null;
    attempt++;
  }
</script>

{#if Page}
  {#key router.pathname}
    <!-- Each page fades in; query-string changes do not replay it. -->
    <div class="animate-enter">
      <Page {...router.params} />
    </div>
  {/key}
{:else if failure && failure.route === router.route}
  {@render failed?.({ error: failure.error, retry })}
{:else}
  {@render loading?.()}
{/if}
