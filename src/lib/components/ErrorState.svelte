<!--
  Inline failure state for a query. Pass the thrown error (an ApiError) and a
  retry callback: `<ErrorState error={query.error} onretry={() => query.refetch()} />`.
-->
<script lang="ts">
  import TriangleAlertIcon from '@lucide/svelte/icons/triangle-exclamation-point';
  import RotateCwIcon from '@lucide/svelte/icons/rotate-cw';
  import { Button } from '$lib/components/ui/button';
  import { errorMessage, isApiError } from '$lib/api/errors';
  import { cn } from '$lib/utils/cn';

  interface Props {
    /** The thrown value; its message is shown unless `message` is given. */
    error?: unknown;
    title?: string;
    message?: string;
    onretry?: () => void;
    /** Disable the retry button while a refetch is running. */
    retrying?: boolean;
    compact?: boolean;
    class?: string;
  }

  let {
    error,
    title,
    message,
    onretry,
    retrying = false,
    compact = false,
    class: className,
  }: Props = $props();

  const notFound = $derived(isApiError(error) && error.isNotFound);
  const heading = $derived(title ?? (notFound ? 'Not found' : 'Could not load this'));
  const text = $derived(
    message ??
      (notFound
        ? 'This record does not exist or was deleted.'
        : errorMessage(error, 'An unexpected error occurred.')),
  );
  const requestId = $derived(isApiError(error) ? error.requestId : undefined);
</script>

<div
  role="alert"
  class={cn(
    'border-danger/30 bg-danger/5 flex flex-col items-center justify-center rounded-lg border text-center',
    compact ? 'gap-2 px-4 py-6' : 'gap-3 px-6 py-12',
    className,
  )}
>
  <TriangleAlertIcon class="text-danger size-5" aria-hidden="true" />
  <div class="space-y-1">
    <p class="text-foreground text-sm font-medium">{heading}</p>
    <p class="text-muted-foreground mx-auto max-w-md text-sm text-pretty">{text}</p>
    {#if requestId}
      <p class="text-muted-foreground font-mono text-xs">Request ID: {requestId}</p>
    {/if}
  </div>
  {#if onretry && !notFound}
    <Button variant="outline" size="sm" onclick={onretry} disabled={retrying}>
      <RotateCwIcon class={retrying ? 'animate-spin' : ''} aria-hidden="true" />
      Try again
    </Button>
  {/if}
</div>
