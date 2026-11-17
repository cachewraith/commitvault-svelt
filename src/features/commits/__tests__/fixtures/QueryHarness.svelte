<!--
  Test harness: renders a component inside a fresh QueryClient (no retries, no
  cache shared between tests) and, optionally, the confirm dialog host.
-->
<script lang="ts">
  import type { Component } from 'svelte';
  import { QueryClientProvider } from '@tanstack/svelte-query';
  import { createQueryClient } from '$lib/api/query-client';
  import { ConfirmDialogHost } from '$lib/components';

  interface Props {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: Component<any>;
    props?: Record<string, unknown>;
    confirmHost?: boolean;
  }

  let { component: Inner, props = {}, confirmHost = false }: Props = $props();

  const client = createQueryClient();
</script>

<QueryClientProvider {client}>
  <Inner {...props} />
  {#if confirmHost}
    <ConfirmDialogHost />
  {/if}
</QueryClientProvider>
