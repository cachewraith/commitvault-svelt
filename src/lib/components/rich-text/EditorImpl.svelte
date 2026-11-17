<!--
  Tiptap editor implementation. Loaded lazily through `RichTextEditor.svelte`
  so Tiptap/ProseMirror/lowlight stay out of the initial bundle — import that
  wrapper, never this file.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { Editor, type JSONContent } from '@tiptap/core';
  import type { RichTextDoc } from '$lib/types';
  import { cn } from '$lib/utils/cn';
  import { sanitizeDoc } from './doc';
  import { createExtensions } from './extensions';
  import { normaliseCodeLanguage } from './schema';
  import Toolbar from './Toolbar.svelte';
  import type { RichTextEditorProps } from './types';

  let {
    value = null,
    onchange,
    placeholder,
    disabled = false,
    label = 'Rich text editor',
    autofocus = false,
    minHeight = '16rem',
    invalid = false,
    describedBy,
    class: className,
  }: RichTextEditorProps = $props();

  let element: HTMLDivElement;
  let editor = $state.raw<Editor | null>(null);
  /** Bumped on every transaction; drives toolbar active states. */
  let revision = $state(0);
  /** Plain counter behind `revision` (transactions can fire inside effects: write, never read). */
  let transactions = 0;
  let revisionQueued = false;

  /**
   * Publish the transaction count on the next microtask. ProseMirror can
   * dispatch synchronously while Svelte is updating the DOM — e.g. the blur
   * transaction fired when a focused editor is removed by a route change —
   * and writing `$state` at that moment throws `state_unsafe_mutation`.
   */
  function publishRevision() {
    if (revisionQueued) return;
    revisionQueued = true;
    queueMicrotask(() => {
      revisionQueued = false;
      if (editor) revision = transactions;
    });
  }
  /** The document object most recently handed to `onchange`. */
  let lastEmitted: RichTextDoc | null = null;
  /**
   * Set by the first real user interaction. Until then document changes are
   * editor housekeeping (e.g. the trailing-paragraph plugin) and must not be
   * reported as edits — otherwise opening a note would trigger an autosave.
   */
  let interacted = false;

  /** Constrain code-block languages typed via ```lang to the curated set. */
  function normalise(node: JSONContent): JSONContent {
    if (node.type === 'codeBlock') {
      const language = normaliseCodeLanguage(node.attrs?.language);
      if (language !== (node.attrs?.language ?? null)) {
        node = { ...node, attrs: { ...node.attrs, language } };
      }
    }
    if (node.content) {
      let changed = false;
      const content = node.content.map((child) => {
        const next = normalise(child);
        if (next !== child) changed = true;
        return next;
      });
      if (changed) node = { ...node, content };
    }
    return node;
  }

  function surfaceAttributes(): Record<string, string> {
    const attributes: Record<string, string> = {
      class: 'rich-text px-4 py-3',
      role: 'textbox',
      'aria-multiline': 'true',
      'aria-label': label,
      spellcheck: 'true',
      style: `min-height: ${minHeight}`,
    };
    if (invalid) attributes['aria-invalid'] = 'true';
    if (describedBy) attributes['aria-describedby'] = describedBy;
    return attributes;
  }

  onMount(() => {
    const instance = new Editor({
      element,
      extensions: createExtensions({ placeholder }),
      content: sanitizeDoc($state.snapshot(value)),
      editable: !disabled,
      autofocus: autofocus ? 'end' : false,
      editorProps: { attributes: surfaceAttributes() },
      onTransaction: () => {
        transactions += 1;
        publishRevision();
      },
      onUpdate: ({ editor: current }) => {
        if (!interacted) return;
        const doc = normalise(current.getJSON()) as RichTextDoc;
        lastEmitted = doc;
        onchange?.(doc);
      },
    });
    editor = instance;

    return () => {
      editor = null;
      instance.destroy();
    };
  });

  // Follow `disabled`.
  $effect(() => {
    editor?.setEditable(!disabled, false);
  });

  // Follow accessibility attributes.
  $effect(() => {
    const attributes = surfaceAttributes();
    editor?.setOptions({ editorProps: { attributes } });
  });

  // Follow external `value` changes (record loaded, form reset). Edits made in
  // this editor come back as the object we emitted and are skipped.
  $effect(() => {
    const next = value;
    const instance = editor;
    if (!instance || next === lastEmitted) return;
    const incoming = sanitizeDoc($state.snapshot(next));
    if (isCurrentDocument(instance, incoming)) return;
    instance.commands.setContent(incoming, { emitUpdate: false });
  });

  /** Structural comparison through the schema, so default attrs and key order do not matter. */
  function isCurrentDocument(instance: Editor, incoming: RichTextDoc): boolean {
    try {
      return instance.schema.nodeFromJSON(incoming).eq(instance.state.doc);
    } catch {
      return false;
    }
  }

  function markInteracted() {
    interacted = true;
  }
</script>

<!-- Capture-phase listeners only record that the user touched the editor; they handle nothing. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  onpointerdowncapture={markInteracted}
  onkeydowncapture={markInteracted}
  onbeforeinputcapture={markInteracted}
  onpastecapture={markInteracted}
  ondropcapture={markInteracted}
  onchangecapture={markInteracted}
  class={cn(
    'bg-card focus-within:border-ring focus-within:ring-ring/50 rounded-lg border transition-colors focus-within:ring-3',
    invalid && 'border-destructive',
    disabled && 'opacity-60',
    className,
  )}
>
  {#if editor}
    <Toolbar
      {editor}
      {revision}
      {disabled}
      class="bg-card sticky top-[var(--header-height,0px)] z-10 rounded-t-lg border-b"
    />
  {:else}
    <div class="h-9 border-b" aria-hidden="true"></div>
  {/if}
  <div bind:this={element}></div>
</div>
