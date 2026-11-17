<!-- Shown when no route matches the URL (signed in: inside the app shell; signed out: standalone). -->
<script lang="ts">
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
  import FileQuestionIcon from '@lucide/svelte/icons/file-question-mark';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import { Button } from '$lib/components/ui/button';
  import { router } from '$lib/router';
  import { session } from '$lib/stores/session.svelte';
</script>

<div class="page flex min-h-[60dvh] items-center justify-center">
  <EmptyState
    icon={FileQuestionIcon}
    title="Page not found"
    description={`Nothing lives at ${router.pathname}. The link may be outdated or mistyped.`}
    bordered={false}
  >
    {#snippet action()}
      {#if session.isAuthenticated}
        <Button href="/" variant="outline" size="sm">
          <ArrowLeftIcon aria-hidden="true" />
          Back to dashboard
        </Button>
        <Button href="/search" variant="ghost" size="sm">Search instead</Button>
      {:else}
        <Button href="/login" size="sm">Go to sign in</Button>
      {/if}
    {/snippet}
  </EmptyState>
</div>
