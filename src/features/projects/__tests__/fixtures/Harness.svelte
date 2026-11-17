<!--
  Test harness: renders a component inside the providers every screen expects
  (a fresh QueryClient and the confirmation dialog host).
-->
<script lang="ts">
  import type { Component } from 'svelte';
  import { QueryClientProvider } from '@tanstack/svelte-query';
  import { createQueryClient } from '$lib/api';
  import { ConfirmDialogHost } from '$lib/components';

  interface Props {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: Component<any>;
    props?: Record<string, unknown>;
  }

  let { component: Subject, props = {} }: Props = $props();

  const client = createQueryClient();
</script>

<QueryClientProvider {client}>
  <Subject {...props} />
  <ConfirmDialogHost />
</QueryClientProvider>
