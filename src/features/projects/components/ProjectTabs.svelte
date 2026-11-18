<!--
  Sections of one project, shown under the header of every project screen so
  you always see where you are inside it. Marked `data-full-page`: these links
  navigate to the section instead of opening the side panel.
-->
<script lang="ts">
  import { router } from '$lib/router';
  import { cn } from '$lib/utils';
  import { paths } from '$routes/paths';

  let { projectId, class: className }: { projectId: string; class?: string } = $props();

  const tabs = $derived([
    { label: 'Overview', href: paths.project(projectId) },
    { label: 'Branches', href: paths.projectBranches(projectId) },
    { label: 'Environments', href: paths.projectEnvironments(projectId) },
    { label: 'Compare', href: paths.projectCompare(projectId) },
    { label: 'Settings', href: paths.projectSettings(projectId) },
  ]);
</script>

<nav aria-label="Project sections" data-full-page class={cn('-mt-2 mb-6 border-b', className)}>
  <ul class="-mb-px flex gap-1 overflow-x-auto">
    {#each tabs as tab (tab.href)}
      {@const active = router.pathname === tab.href}
      <li>
        <a
          href={tab.href}
          aria-current={active ? 'page' : undefined}
          class={cn(
            'relative inline-flex h-9 items-center px-3 text-sm whitespace-nowrap transition-colors duration-150',
            active ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {tab.label}
          {#if active}
            <span class="bg-foreground animate-enter absolute inset-x-2 bottom-0 h-0.5 rounded-full" aria-hidden="true"></span>
          {/if}
        </a>
      </li>
    {/each}
  </ul>
</nav>
