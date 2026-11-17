<!--
  Formatting toolbar for the rich-text editor. Single tab stop with arrow-key
  navigation (role="toolbar"); every toggle exposes aria-pressed.
-->
<script lang="ts">
  import type { Editor } from '@tiptap/core';
  import BoldIcon from '@lucide/svelte/icons/letter-b';
  import ItalicIcon from '@lucide/svelte/icons/italic';
  import UnderlineIcon from '@lucide/svelte/icons/underline';
  import StrikethroughIcon from '@lucide/svelte/icons/strikethrough';
  import CodeIcon from '@lucide/svelte/icons/code';
  import ListIcon from '@lucide/svelte/icons/list';
  import ListOrderedIcon from '@lucide/svelte/icons/list-ordered';
  import ListChecksIcon from '@lucide/svelte/icons/list-checks';
  import TextQuoteIcon from '@lucide/svelte/icons/text-quote';
  import SquareCodeIcon from '@lucide/svelte/icons/square-code';
  import MinusIcon from '@lucide/svelte/icons/minus';
  import LinkIcon from '@lucide/svelte/icons/link';
  import ImageIcon from '@lucide/svelte/icons/image';
  import TableIcon from '@lucide/svelte/icons/table';
  import UndoIcon from '@lucide/svelte/icons/undo-2';
  import RedoIcon from '@lucide/svelte/icons/redo-2';
  import { Button } from '$lib/components/ui/button';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import { Input } from '$lib/components/ui/input';
  import * as Popover from '$lib/components/ui/popover';
  import { cn } from '$lib/utils/cn';
  import ToolbarButton from './ToolbarButton.svelte';
  import { rovingToolbar } from './roving';
  import {
    CODE_LANGUAGES,
    HEADING_LEVELS,
    isAllowedImageSrc,
    normaliseLinkHref,
    type HeadingLevel,
  } from './schema';

  interface Props {
    editor: Editor;
    /** Bumped by the editor on every transaction so active states re-evaluate. */
    revision: number;
    disabled?: boolean;
    class?: string;
  }

  let { editor, revision, disabled = false, class: className }: Props = $props();

  const uid = $props.id();

  /** Read editor state reactively (re-runs when `revision` changes). */
  function isActive(name: string, attrs?: Record<string, unknown>): boolean {
    void revision;
    return editor.isActive(name, attrs);
  }

  const blockType = $derived.by(() => {
    void revision;
    for (const level of HEADING_LEVELS) {
      if (editor.isActive('heading', { level })) return `h${level}`;
    }
    return 'p';
  });

  const inTable = $derived(isActive('table'));
  const inCodeBlock = $derived(isActive('codeBlock'));
  const codeLanguage = $derived.by(() => {
    void revision;
    return (editor.getAttributes('codeBlock').language as string | null) ?? '';
  });
  const canUndo = $derived.by(() => {
    void revision;
    return editor.can().undo();
  });
  const canRedo = $derived.by(() => {
    void revision;
    return editor.can().redo();
  });

  const chain = () => editor.chain().focus();

  function setBlockType(event: Event) {
    const value = (event.currentTarget as HTMLSelectElement).value;
    if (value === 'p') chain().setParagraph().run();
    else chain().setHeading({ level: Number(value.slice(1)) as HeadingLevel }).run();
  }

  function setCodeLanguage(event: Event) {
    const value = (event.currentTarget as HTMLSelectElement).value;
    chain().updateAttributes('codeBlock', { language: value === '' ? null : value }).run();
  }

  // --- Link popover ---------------------------------------------------------
  let linkOpen = $state(false);
  let linkUrl = $state('');
  let linkError = $state<string | null>(null);

  function openLink(open: boolean) {
    linkOpen = open;
    if (open) {
      linkUrl = (editor.getAttributes('link').href as string | undefined) ?? '';
      linkError = null;
    }
  }

  function applyLink(event: SubmitEvent) {
    event.preventDefault();
    const href = normaliseLinkHref(linkUrl);
    if (!href) {
      linkError = 'Enter an http(s) URL or an email address.';
      return;
    }
    chain().extendMarkRange('link').setLink({ href }).run();
    linkOpen = false;
  }

  function removeLink() {
    chain().extendMarkRange('link').unsetLink().run();
    linkOpen = false;
  }

  // --- Image popover --------------------------------------------------------
  let imageOpen = $state(false);
  let imageUrl = $state('');
  let imageAlt = $state('');
  let imageError = $state<string | null>(null);

  function openImage(open: boolean) {
    imageOpen = open;
    if (open) {
      imageUrl = '';
      imageAlt = '';
      imageError = null;
    }
  }

  function insertImage(event: SubmitEvent) {
    event.preventDefault();
    const src = imageUrl.trim();
    if (!isAllowedImageSrc(src)) {
      imageError = 'Enter an image URL starting with http:// or https://.';
      return;
    }
    chain()
      .setImage({ src, alt: imageAlt.trim() || undefined })
      .run();
    imageOpen = false;
  }

  const selectClass =
    'border-input dark:bg-input/30 text-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-7 rounded-md border bg-transparent px-1.5 text-xs outline-none focus-visible:ring-3 disabled:opacity-40';
  const triggerClass =
    'text-muted-foreground hover:bg-muted hover:text-foreground aria-pressed:bg-accent aria-pressed:text-foreground flex size-7 shrink-0 items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-40';
</script>

{#snippet divider()}
  <span class="bg-border mx-1 h-5 w-px shrink-0" role="separator" aria-orientation="vertical"></span>
{/snippet}

<div
  use:rovingToolbar
  role="toolbar"
  aria-label="Formatting"
  aria-orientation="horizontal"
  class={cn('flex flex-wrap items-center gap-0.5 px-1.5 py-1', className)}
>
  <ToolbarButton label="Undo" shortcut="Ctrl+Z" icon={UndoIcon} disabled={disabled || !canUndo} onclick={() => chain().undo().run()} />
  <ToolbarButton label="Redo" shortcut="Ctrl+Shift+Z" icon={RedoIcon} disabled={disabled || !canRedo} onclick={() => chain().redo().run()} />

  {@render divider()}

  <label for={`${uid}-block`} class="sr-only">Text style</label>
  <select
    id={`${uid}-block`}
    data-toolbar-item
    tabindex="-1"
    class={selectClass}
    value={blockType}
    disabled={disabled || inCodeBlock}
    onchange={setBlockType}
  >
    <option value="p">Paragraph</option>
    {#each HEADING_LEVELS as level (level)}
      <option value={`h${level}`}>Heading {level}</option>
    {/each}
  </select>

  {@render divider()}

  <ToolbarButton label="Bold" shortcut="Ctrl+B" icon={BoldIcon} pressed={isActive('bold')} {disabled} onclick={() => chain().toggleBold().run()} />
  <ToolbarButton label="Italic" shortcut="Ctrl+I" icon={ItalicIcon} pressed={isActive('italic')} {disabled} onclick={() => chain().toggleItalic().run()} />
  <ToolbarButton label="Underline" shortcut="Ctrl+U" icon={UnderlineIcon} pressed={isActive('underline')} {disabled} onclick={() => chain().toggleUnderline().run()} />
  <ToolbarButton label="Strikethrough" shortcut="Ctrl+Shift+S" icon={StrikethroughIcon} pressed={isActive('strike')} {disabled} onclick={() => chain().toggleStrike().run()} />
  <ToolbarButton label="Inline code" shortcut="Ctrl+E" icon={CodeIcon} pressed={isActive('code')} {disabled} onclick={() => chain().toggleCode().run()} />

  {@render divider()}

  <ToolbarButton label="Bullet list" icon={ListIcon} pressed={isActive('bulletList')} {disabled} onclick={() => chain().toggleBulletList().run()} />
  <ToolbarButton label="Numbered list" icon={ListOrderedIcon} pressed={isActive('orderedList')} {disabled} onclick={() => chain().toggleOrderedList().run()} />
  <ToolbarButton label="Checklist" icon={ListChecksIcon} pressed={isActive('taskList')} {disabled} onclick={() => chain().toggleTaskList().run()} />

  {@render divider()}

  <ToolbarButton label="Quote" icon={TextQuoteIcon} pressed={isActive('blockquote')} {disabled} onclick={() => chain().toggleBlockquote().run()} />
  <ToolbarButton label="Code block" icon={SquareCodeIcon} pressed={inCodeBlock} {disabled} onclick={() => chain().toggleCodeBlock().run()} />
  {#if inCodeBlock}
    <label for={`${uid}-language`} class="sr-only">Code language</label>
    <select
      id={`${uid}-language`}
      data-toolbar-item
      tabindex="-1"
      class={selectClass}
      value={codeLanguage}
      {disabled}
      onchange={setCodeLanguage}
    >
      <option value="">Auto-detect</option>
      {#each CODE_LANGUAGES as language (language.id)}
        <option value={language.id}>{language.label}</option>
      {/each}
    </select>
  {/if}
  <ToolbarButton label="Horizontal rule" icon={MinusIcon} {disabled} onclick={() => chain().setHorizontalRule().run()} />

  {@render divider()}

  <!-- Link -->
  <Popover.Root open={linkOpen} onOpenChange={openLink}>
    <Popover.Trigger
      data-toolbar-item
      tabindex={-1}
      class={triggerClass}
      aria-label="Link"
      aria-pressed={isActive('link')}
      title="Link (Ctrl+K)"
      {disabled}
    >
      <LinkIcon class="size-4" aria-hidden="true" />
    </Popover.Trigger>
    <Popover.Content align="start" class="w-80">
      <form class="flex flex-col gap-2" onsubmit={applyLink} novalidate>
        <label for={`${uid}-link`} class="text-sm font-medium">Link URL</label>
        <Input
          id={`${uid}-link`}
          type="url"
          inputmode="url"
          placeholder="https://example.com"
          autocomplete="off"
          bind:value={linkUrl}
          aria-invalid={linkError ? 'true' : undefined}
          aria-describedby={linkError ? `${uid}-link-error` : undefined}
        />
        {#if linkError}
          <p id={`${uid}-link-error`} class="text-danger text-xs" role="alert">{linkError}</p>
        {/if}
        <div class="flex justify-end gap-2">
          {#if isActive('link')}
            <Button type="button" variant="ghost" size="sm" onclick={removeLink}>Remove link</Button>
          {/if}
          <Button type="submit" size="sm">Apply</Button>
        </div>
      </form>
    </Popover.Content>
  </Popover.Root>

  <!-- Image by URL -->
  <Popover.Root open={imageOpen} onOpenChange={openImage}>
    <Popover.Trigger
      data-toolbar-item
      tabindex={-1}
      class={triggerClass}
      aria-label="Image"
      title="Image from URL"
      {disabled}
    >
      <ImageIcon class="size-4" aria-hidden="true" />
    </Popover.Trigger>
    <Popover.Content align="start" class="w-80">
      <form class="flex flex-col gap-2" onsubmit={insertImage} novalidate>
        <label for={`${uid}-image`} class="text-sm font-medium">Image URL</label>
        <Input
          id={`${uid}-image`}
          type="url"
          inputmode="url"
          placeholder="https://example.com/diagram.png"
          autocomplete="off"
          bind:value={imageUrl}
          aria-invalid={imageError ? 'true' : undefined}
          aria-describedby={imageError ? `${uid}-image-error` : `${uid}-image-hint`}
        />
        {#if imageError}
          <p id={`${uid}-image-error`} class="text-danger text-xs" role="alert">{imageError}</p>
        {/if}
        <label for={`${uid}-image-alt`} class="text-sm font-medium">
          Description <span class="text-muted-foreground font-normal">(alt text)</span>
        </label>
        <Input id={`${uid}-image-alt`} placeholder="What the image shows" bind:value={imageAlt} />
        <p id={`${uid}-image-hint`} class="text-muted-foreground text-xs">
          Images are linked by URL; they are not uploaded to CommitVault.
        </p>
        <div class="flex justify-end">
          <Button type="submit" size="sm">Insert image</Button>
        </div>
      </form>
    </Popover.Content>
  </Popover.Root>

  <!-- Table -->
  {#if inTable}
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        data-toolbar-item
        tabindex={-1}
        class={triggerClass}
        aria-label="Table options"
        aria-pressed={true}
        title="Table options"
        {disabled}
      >
        <TableIcon class="size-4" aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" class="w-52">
        <DropdownMenu.Item onSelect={() => chain().addRowBefore().run()}>Add row above</DropdownMenu.Item>
        <DropdownMenu.Item onSelect={() => chain().addRowAfter().run()}>Add row below</DropdownMenu.Item>
        <DropdownMenu.Item onSelect={() => chain().addColumnBefore().run()}>Add column left</DropdownMenu.Item>
        <DropdownMenu.Item onSelect={() => chain().addColumnAfter().run()}>Add column right</DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item onSelect={() => chain().toggleHeaderRow().run()}>Toggle header row</DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item onSelect={() => chain().deleteRow().run()}>Delete row</DropdownMenu.Item>
        <DropdownMenu.Item onSelect={() => chain().deleteColumn().run()}>Delete column</DropdownMenu.Item>
        <DropdownMenu.Item variant="destructive" onSelect={() => chain().deleteTable().run()}>
          Delete table
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  {:else}
    <ToolbarButton
      label="Insert table"
      icon={TableIcon}
      {disabled}
      onclick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
    />
  {/if}
</div>
