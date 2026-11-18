<!--
  The app-wide side panel. Shows the record named in `?panel=<type>.<id>`
  using the same detail component as the record's full page (loaded on first
  use). Mounted once by App.svelte inside the signed-in layout; while mounted,
  plain clicks on record links anywhere open here (see `$lib/router/panel`).
-->
<script lang="ts">
  import { onMount, type Component } from 'svelte';
  import { DetailPanel, DetailSkeleton } from '$lib/components';
  import { recordPanel, setPanelHostMounted } from '$lib/router';
  import { paths } from '$routes/paths';

  // Detail components take different id props; everything else is shared.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type DetailComponent = Component<any>;

  interface Kind {
    label: string;
    idProp: string;
    href: (id: string) => string;
    load: () => Promise<{ default: DetailComponent }>;
  }

  const KINDS: Record<string, Kind> = {
    project: {
      label: 'Project',
      idProp: 'projectId',
      href: paths.project,
      load: () => import('$features/projects/components/ProjectDetail.svelte'),
    },
    branch: {
      label: 'Branch',
      idProp: 'branchId',
      href: paths.branch,
      load: () => import('$features/branches/components/BranchDetail.svelte'),
    },
    commit: {
      label: 'Commit',
      idProp: 'commitId',
      href: paths.commit,
      load: () => import('$features/commits/components/CommitDetail.svelte'),
    },
    deployment: {
      label: 'Deployment record',
      idProp: 'deploymentId',
      href: paths.deployment,
      load: () => import('$features/deployments/components/DeploymentDetail.svelte'),
    },
    release: {
      label: 'Release',
      idProp: 'releaseId',
      href: paths.release,
      load: () => import('$features/releases/components/ReleaseDetail.svelte'),
    },
    note: {
      label: 'Note',
      idProp: 'noteId',
      href: paths.note,
      load: () => import('$features/notes/components/NoteDetail.svelte'),
    },
  };

  onMount(() => {
    setPanelHostMounted(true);
    return () => setPanelHostMounted(false);
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
