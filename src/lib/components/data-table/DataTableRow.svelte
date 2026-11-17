<!--
  Table row. With `href` the whole row is clickable (mouse convenience) while
  keyboard and screen-reader users use the real link you place in a cell.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { navigate } from '$lib/router';
  import { cn } from '$lib/utils/cn';

  interface Props {
    children: Snippet;
    /** In-app path opened when the row itself (not a control inside it) is clicked. */
    href?: string;
    selected?: boolean;
    class?: string;
  }

  let { children, href, selected = false, class: className }: Props = $props();

  function onclick(event: MouseEvent) {
    if (!href || event.defaultPrevented || event.button !== 0) return;
    const target = event.target as Element | null;
    // Let real controls and text selection behave normally.
    if (target?.closest('a, button, input, select, textarea, label, [role="button"], [role="menuitem"]')) return;
    if (window.getSelection()?.toString()) return;
    if (event.metaKey || event.ctrlKey) {
      window.open(href, '_blank', 'noopener');
      return;
    }
    navigate(href);
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<tr
  class={cn(
    'hover:bg-muted/40 border-b transition-colors',
    href && 'cursor-pointer',
    selected && 'bg-muted/60',
    className,
  )}
  data-state={selected ? 'selected' : undefined}
  {onclick}
>
  {@render children()}
</tr>
