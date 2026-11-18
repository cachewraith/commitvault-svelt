<!--
  The app-wide side panel. Shows the record named in `?panel=<type>.<id>`
  using the same detail component as the record's full page (loaded on first
  use). Mounted once by App.svelte inside the signed-in layout; while mounted,
  plain clicks on record links anywhere open here (see `$lib/router/panel`).

  Resting the pointer on (or focusing) a record link prefetches that
  record's view and data, so the panel usually opens without waiting.
-->
<script lang="ts">
  import { onMount, type Component } from 'svelte';
  import { useQueryClient, type QueryKey } from '@tanstack/svelte-query';
  import { queryKeys } from '$lib/api';
  import { DetailPanel, DetailSkeleton } from '$lib/components';
  import { panelTargetFor, recordPanel, setPanelHostMounted } from '$lib/router';
  import { branchesApi } from '$features/branches/api';
  import { commitsApi } from '$features/commits/api';
  import { deploymentsApi } from '$features/deployments/api';
  import { notesApi } from '$features/notes/api';
  import { projectsApi } from '$features/projects/api';
  import { releasesApi } from '$features/releases/api';
  import { paths } from '$routes/paths';

  // Detail components take different id props; everything else is shared.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type DetailComponent = Component<any>;

  interface Kind {
    label: string;
    idProp: string;
    href: (id: string) => string;
    load: () => Promise<{ default: DetailComponent }>;
    /** The detail component's main query, so it can be warmed before the click. */
    query: (id: string) => { queryKey: QueryKey; queryFn: (context: { signal: AbortSignal }) => Promise<unknown> };
  }

  const KINDS: Record<string, Kind> = {
    project: {
      label: 'Project',
      idProp: 'projectId',
      href: paths.project,
      load: () => import('$features/projects/components/ProjectDetail.svelte'),
      query: (id) => ({ queryKey: queryKeys.projects.detail(id), queryFn: ({ signal }) => projectsApi.get(id, signal) }),
    },
    branch: {
      label: 'Branch',
      idProp: 'branchId',
      href: paths.branch,
      load: () => import('$features/branches/components/BranchDetail.svelte'),
      query: (id) => ({ queryKey: queryKeys.branches.detail(id), queryFn: ({ signal }) => branchesApi.get(id, signal) }),
    },
    commit: {
      label: 'Commit',
      idProp: 'commitId',
      href: paths.commit,
      load: () => import('$features/commits/components/CommitDetail.svelte'),
      query: (id) => ({ queryKey: queryKeys.commits.detail(id), queryFn: ({ signal }) => commitsApi.get(id, signal) }),
    },
    deployment: {
      label: 'Deployment record',
      idProp: 'deploymentId',
      href: paths.deployment,
      load: () => import('$features/deployments/components/DeploymentDetail.svelte'),
      query: (id) => ({
        queryKey: queryKeys.deployments.detail(id),
        queryFn: ({ signal }) => deploymentsApi.get(id, signal),
      }),
    },
    release: {
      label: 'Release',
      idProp: 'releaseId',
      href: paths.release,
      load: () => import('$features/releases/components/ReleaseDetail.svelte'),
      query: (id) => ({ queryKey: queryKeys.releases.detail(id), queryFn: ({ signal }) => releasesApi.get(id, signal) }),
    },
    note: {
      label: 'Note',
      idProp: 'noteId',
      href: paths.note,
      load: () => import('$features/notes/components/NoteDetail.svelte'),
      query: (id) => ({ queryKey: queryKeys.notes.detail(id), queryFn: ({ signal }) => notesApi.get(id, signal) }),
    },
  };

  const queryClient = useQueryClient();

  /** How long the pointer must rest on a link before prefetching (skips fly-overs). */
  const HOVER_DELAY_MS = 80;

  function prefetch(href: string | null) {
    const target = panelTargetFor(href);
    const kind = target ? KINDS[target.type] : undefined;
    if (!target || !kind) return;
    void kind.load().catch(() => undefined);
    // Fresh data (< 30 s, the app-wide staleTime) is not fetched again.
    void queryClient.prefetchQuery({ ...kind.query(target.id), staleTime: 30_000 });
  }

  onMount(() => {
    setPanelHostMounted(true);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const linkOf = (event: Event) => (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    const onPointerOver = (event: PointerEvent) => {
      const anchor = linkOf(event);
      clearTimeout(timer);
      if (anchor) timer = setTimeout(() => prefetch(anchor.href), HOVER_DELAY_MS);
    };
    const onFocusIn = (event: FocusEvent) => prefetch(linkOf(event)?.href ?? null);
    document.addEventListener('pointerover', onPointerOver);
    document.addEventListener('focusin', onFocusIn);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerover', onPointerOver);
      document.removeEventListener('focusin', onFocusIn);
      setPanelHostMounted(false);
    };
  });

  const current = $derived(recordPanel.current);
  const kind = $derived(current ? KINDS[current.type] : undefined);

  function close() {
    recordPanel.close();
  }
</script>

<DetailPanel
  open={current !== null && kind !== undefined}
  onclose={close}
  label={kind?.label ?? 'Details'}
  fullPageHref={current && kind ? kind.href(current.id) : undefined}
>
  {#if current && kind}
    {#key `${current.type}.${current.id}`}
      {#await kind.load()}
        <DetailSkeleton />
      {:then module}
        {@const Detail = module.default}
        <Detail {...{ [kind.idProp]: current.id }} layout="panel" ondeleted={close} />
      {:catch}
        <p class="text-muted-foreground text-sm">This view could not be loaded. Check your connection and try again.</p>
      {/await}
    {/key}
  {/if}
</DetailPanel>
