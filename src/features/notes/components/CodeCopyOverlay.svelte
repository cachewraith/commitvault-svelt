<!--
  Adds a "Copy" button to every code block rendered inside it.

  The buttons live in a layer next to the rendered document rather than inside
  it: the viewer's DOM is owned by Tiptap/ProseMirror and must not be mutated.
  Copy only — stored commands are documentation and are never executed.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { CopyButton } from '$lib/components';

  let { children }: { children: Snippet } = $props();

  interface Block {
    top: number;
    text: string;
  }

  let container = $state<HTMLDivElement | null>(null);
  let blocks = $state.raw<Block[]>([]);

  function measure(root: HTMLElement) {
    const origin = root.getBoundingClientRect().top;
    const next = Array.from(root.querySelectorAll('pre')).map((pre) => ({
      top: pre.getBoundingClientRect().top - origin,
      text: pre.textContent ?? '',
    }));
    const unchanged =
      next.length === blocks.length &&
      next.every((block, index) => block.top === blocks[index]?.top && block.text === blocks[index]?.text);
    if (!unchanged) blocks = next;
  }

  $effect(() => {
    const root = container;
    if (!root) return;
    const update = () => measure(root);
    // The viewer loads lazily and lays out after fonts/images arrive.
    const mutations = new MutationObserver(update);
    mutations.observe(root, { childList: true, subtree: true, characterData: true });
    const resize = new ResizeObserver(update);
    resize.observe(root);
    update();
    return () => {
      mutations.disconnect();
      resize.disconnect();
    };
  });
</script>

<div class="relative">
  <div bind:this={container}>
    {@render children()}
  </div>
  {#each blocks as block, index (index)}
    <div class="absolute right-1.5" style:top="{block.top + 6}px">
      <CopyButton
        value={block.text}
        label="Copy code block {index + 1}"
        variant="outline"
        size="icon-sm"
        class="bg-card/90 backdrop-blur-sm"
      />
    </div>
  {/each}
</div>
