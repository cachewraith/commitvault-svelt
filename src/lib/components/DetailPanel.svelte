<!--
  Record details in a panel that slides in from the right, over a list.
  Full width on small screens. Escape, the close button, a click outside
  and the browser's Back button (see `detailPanel()`) all close it; "Open
  full page" leads to the record's own route.

    <DetailPanel open={panel.id !== null} onclose={panel.close} label="Commit details" fullPageHref={…}>
      <CommitDetail commitId={panel.id} layout="panel" />
    </DetailPanel>
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import MaximizeIcon from '@lucide/svelte/icons/maximize-2';
  import XIcon from '@lucide/svelte/icons/x';
  import { Button } from '$lib/components/ui/button';
  import * as Sheet from '$lib/components/ui/sheet';

  interface Props {
    open: boolean;
    onclose: () => void;
    /** Accessible name of the panel, e.g. "Commit details". */
    label: string;
    /** Route of the record's full page. */
    fullPageHref?: string;
    children: Snippet;
  }

  let { open, onclose, label, fullPageHref, children }: Props = $props();
</script>

<Sheet.Root {open} onOpenChange={(next) => !next && onclose()}>
  <Sheet.Content
    side="right"
    showCloseButton={false}
    class="w-full gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl"
  >
    <div class="bg-popover/95 sticky top-0 z-10 flex h-12 shrink-0 items-center gap-1 border-b px-4 pr-2 backdrop-blur">
      <Sheet.Title class="text-muted-foreground text-sm font-medium">{label}</Sheet.Title>
      <Sheet.Description class="sr-only">Press Escape to close.</Sheet.Description>
      {#if fullPageHref}
        <Button variant="ghost" size="sm" href={fullPageHref} class="ml-auto">
          <MaximizeIcon aria-hidden="true" />
          Open full page
        </Button>
      {/if}
      <Sheet.Close>
        {#snippet child({ props })}
          <Button {...props} variant="ghost" size="icon-sm" class={fullPageHref ? '' : 'ml-auto'} aria-label="Close panel">
            <XIcon aria-hidden="true" />
          </Button>
        {/snippet}
      </Sheet.Close>
    </div>
    <div class="p-4">
      {@render children()}
    </div>
  </Sheet.Content>
</Sheet.Root>
