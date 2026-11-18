<!-- LoginPage reads the sign-in options through TanStack Query. -->
<script lang="ts">
  import { QueryClientProvider } from '@tanstack/svelte-query';
  import { createQueryClient } from '$lib/api/query-client';
  import LoginPage from '../../LoginPage.svelte';

  const client = createQueryClient();
</script>

<QueryClientProvider {client}>
  <LoginPage />
</QueryClientProvider>
