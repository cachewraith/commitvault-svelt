<!--
  Top-bar "New" menu: the global quick-create entry point — the two records
  entered most often, then a project and a note. Mounted through the `actions`
  snippet of `AppShell` (lib/layouts never imports features).
-->
<script lang="ts">
  import FolderGitIcon from '@lucide/svelte/icons/folder-git-2';
  import GitCommitIcon from '@lucide/svelte/icons/git-commit-horizontal';
  import NotebookIcon from '@lucide/svelte/icons/notebook-text';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import RocketIcon from '@lucide/svelte/icons/rocket';
  import { Button } from '$lib/components/ui/button';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import { toastError } from '$lib/components/toast';
  import { navigate } from '$lib/router';
  import { paths } from '$routes/paths';

  type CommitDialog = typeof import('./CommitFormDialog.svelte').default;
  type DeploymentDialog = typeof import('$features/deployments/components/DeploymentFormDialog.svelte').default;
  type ProjectDialog = typeof import('$features/projects/components/ProjectFormDialog.svelte').default;

  // The forms (validation, pickers, tag picker) are loaded on first use so the
  // menu adds almost nothing to the initial bundle.
  let CommitFormDialog = $state<CommitDialog | null>(null);
  let DeploymentFormDialog = $state<DeploymentDialog | null>(null);
  let commitOpen = $state(false);
  let deploymentOpen = $state(false);
  let ProjectFormDialog = $state<ProjectDialog | null>(null);
  let projectOpen = $state(false);

  async function openProject() {
    try {
      ProjectFormDialog ??= (await import('$features/projects/components/ProjectFormDialog.svelte')).default;
      projectOpen = true;
    } catch (error) {
      toastError(error, 'The form could not be loaded. Check your connection and try again.');
    }
  }

  async function openCommit() {
    try {
      CommitFormDialog ??= (await import('./CommitFormDialog.svelte')).default;
      commitOpen = true;
    } catch (error) {
      toastError(error, 'The form could not be loaded. Check your connection and try again.');
    }
  }

  async function openDeployment() {
    try {
      DeploymentFormDialog ??= (await import('$features/deployments/components/DeploymentFormDialog.svelte')).default;
      deploymentOpen = true;
    } catch (error) {
      toastError(error, 'The form could not be loaded. Check your connection and try again.');
    }
  }
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="outline" size="sm" aria-label="Create new record">
        <PlusIcon aria-hidden="true" />
        <span class="hidden sm:inline">New</span>
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="end" class="w-52">
    <DropdownMenu.Item onSelect={openCommit}>
      <GitCommitIcon aria-hidden="true" />
      Record commit
    </DropdownMenu.Item>
    <DropdownMenu.Item onSelect={openDeployment}>
      <RocketIcon aria-hidden="true" />
      Record deployment
    </DropdownMenu.Item>
    <DropdownMenu.Separator />
    <DropdownMenu.Item onSelect={openProject}>
      <FolderGitIcon aria-hidden="true" />
      New project
    </DropdownMenu.Item>
    <DropdownMenu.Item onSelect={() => navigate(paths.noteNew())}>
      <NotebookIcon aria-hidden="true" />
      New note
    </DropdownMenu.Item>
  </DropdownMenu.Content>
</DropdownMenu.Root>

{#if CommitFormDialog}
  <CommitFormDialog bind:open={commitOpen} />
{/if}
{#if DeploymentFormDialog}
  <DeploymentFormDialog bind:open={deploymentOpen} />
{/if}
{#if ProjectFormDialog}
  <ProjectFormDialog bind:open={projectOpen} onsaved={(project) => navigate(paths.project(project.id))} />
{/if}
