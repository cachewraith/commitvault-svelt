<!--
  Read-only renderer for stored documents. Content goes through Tiptap's
  schema (non-editable editor), never through `{@html}`: unknown nodes, marks
  and attributes are dropped, and link/image URLs are restricted by the
  extensions. Loaded lazily through `RichTextViewer.svelte`.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { Editor } from '@tiptap/core';
  import { cn } from '$lib/utils/cn';
  import { isEmptyDoc, sanitizeDoc } from './doc';
  import { createExtensions } from './extensions';
  import type { RichTextViewerProps } from './types';

  let { value = null, emptyText = 'Nothing written yet.', class: className }: RichTextViewerProps =
    $props();

  let element: HTMLDivElement;
  let editor = $state.raw<Editor | null>(null);

  const empty = $derived(isEmptyDoc(value));

  onMount(() => {
    const instance = new Editor({
      element,
      extensions: createExtensions({ readonly: true }),
      content: sanitizeDoc($state.snapshot(value)),
      editable: false,
      editorProps: { attributes: { class: 'rich-text' } },
    });
    editor = instance;

    return () => {
      editor = null;
      instance.destroy();
    };
  });

  let first = true;
  $effect(() => {
    const next = value;
    const instance = editor;
    if (!instance) return;
    if (first) {
      // Initial content was set by the constructor.
      first = false;
      return;
    }
    instance.commands.setContent(sanitizeDoc($state.snapshot(next)), { emitUpdate: false });
  });
</script>

{#if empty}
  <p class={cn('text-muted-foreground text-sm italic', className)}>{emptyText}</p>
{/if}
<div bind:this={element} class={cn(empty && 'hidden', className)}></div>
