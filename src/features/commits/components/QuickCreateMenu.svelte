<!--
  Top-bar "New" menu: the global quick-create entry point for the two records
  that are entered most often. Mounted through the `actions` snippet of
  `AppShell` (lib/layouts never imports features).
-->
<script lang="ts">
  import GitCommitIcon from '@lucide/svelte/icons/git-commit-horizontal';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import RocketIcon from '@lucide/svelte/icons/rocket';
  import { Button } from '$lib/components/ui/button';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import { toastError } from '$lib/components/toast';

  type CommitDialog = typeof import('./CommitFormDialog.svelte').default;
  type DeploymentDialog = typeof import('$features/deployments/components/DeploymentFormDialog.svelte').default;

  // The forms (validation, pickers, tag picker) are loaded on first use so the
  // menu adds almost nothing to the initial bundle.
  let CommitFormDialog = $state<CommitDialog | null>(null);
  let DeploymentFormDialog = $state<DeploymentDialog | null>(null);
  let commitOpen = $state(false);
  let deploymentOpen = $state(false);

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
  </DropdownMenu.Content>
</DropdownMenu.Root>

{#if CommitFormDialog}
  <CommitFormDialog bind:open={commitOpen} />
{/if}
{#if DeploymentFormDialog}
  <DeploymentFormDialog bind:open={deploymentOpen} />
{/if}
