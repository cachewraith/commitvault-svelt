<!-- Renders requests made through `confirm()`. Mount exactly once (App.svelte). -->
<script lang="ts">
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import { confirmService } from './confirm.svelte';

  const current = $derived(confirmService.current);
</script>

{#if current}
  {#key current.id}
    <AlertDialog.Root
      open={true}
      onOpenChange={(open) => {
        if (!open) confirmService.settle(false);
      }}
    >
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>{current.title}</AlertDialog.Title>
          {#if current.description}
            <AlertDialog.Description>{current.description}</AlertDialog.Description>
          {/if}
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Cancel onclick={() => confirmService.settle(false)}>
            {current.cancelLabel ?? 'Cancel'}
          </AlertDialog.Cancel>
          <AlertDialog.Action
            variant={current.destructive ? 'destructive' : 'default'}
            onclick={() => confirmService.settle(true)}
          >
            {current.confirmLabel ?? 'Confirm'}
          </AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog.Root>
  {/key}
{/if}
