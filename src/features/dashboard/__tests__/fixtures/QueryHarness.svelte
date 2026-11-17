<!-- Test harness: renders a component inside a fresh QueryClientProvider. -->
<script lang="ts">
  import type { Component } from 'svelte';
  import { QueryClientProvider } from '@tanstack/svelte-query';
  import { createQueryClient } from '$lib/api';

  interface Props {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: Component<any>;
    props?: Record<string, unknown>;
  }

  let { component: Inner, props = {} }: Props = $props();

  const client = createQueryClient();
</script>

<QueryClientProvider {client}>
  <Inner {...props} />
</QueryClientProvider>
