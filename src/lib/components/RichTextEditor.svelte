<!--
  Rich-text editor (Tiptap). The implementation chunk is loaded on demand, so
  importing this component costs nothing until it is rendered.

    let content = $state.raw<RichTextDoc | null>(note.content_json);
    <RichTextEditor value={content} onchange={(doc) => (content = doc)} placeholder="Write the note…" />

  See `rich-text/schema.ts` for the allowed nodes, marks and attributes.
-->
<script lang="ts">
  import { Skeleton } from '$lib/components/ui/skeleton';
  import ErrorState from './ErrorState.svelte';
  import type { RichTextEditorProps } from './rich-text/types';

  let props: RichTextEditorProps = $props();

  let attempt = $state(0);
  const implementation = $derived.by(() => {
    void attempt;
    return import('./rich-text/EditorImpl.svelte');
  });
</script>

{#await implementation}
  <div
    class="bg-card rounded-lg border"
    role="status"
    aria-busy="true"
    aria-label="Loading editor"
  >
    <div class="flex items-center gap-2 border-b px-2 py-1.5">
      {#each { length: 9 } as _, index (index)}
        <Skeleton class="size-6" />
      {/each}
    </div>
    <div class="space-y-3 px-4 py-4" style:min-height={props.minHeight ?? '16rem'}>
      <Skeleton class="h-4 w-2/3" />
      <Skeleton class="h-4 w-full" />
      <Skeleton class="h-4 w-5/6" />
    </div>
  </div>
{:then module}
  <module.default {...props} />
{:catch error}
  <ErrorState
    {error}
    compact
    title="The editor could not be loaded"
    message="Check your connection and try again."
    onretry={() => attempt++}
  />
{/await}
