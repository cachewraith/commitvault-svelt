<!--
  Read-only rendering of a Tiptap JSON document (note reading mode, release
  notes). Lazily loads the same chunk as the editor.

    <RichTextViewer value={note.content_json} />
-->
<script lang="ts">
  import { Skeleton } from '$lib/components/ui/skeleton';
  import ErrorState from './ErrorState.svelte';
  import type { RichTextViewerProps } from './rich-text/types';

  let props: RichTextViewerProps = $props();

  let attempt = $state(0);
  const implementation = $derived.by(() => {
    void attempt;
    return import('./rich-text/ViewerImpl.svelte');
  });
</script>

{#await implementation}
  <div class="space-y-3" role="status" aria-busy="true" aria-label="Loading content">
    <Skeleton class="h-4 w-1/2" />
    <Skeleton class="h-4 w-full" />
    <Skeleton class="h-4 w-11/12" />
    <Skeleton class="h-4 w-3/4" />
  </div>
{:then module}
  <module.default {...props} />
{:catch error}
  <ErrorState
    {error}
    compact
    title="The content could not be displayed"
    message="Check your connection and try again."
    onretry={() => attempt++}
  />
{/await}
