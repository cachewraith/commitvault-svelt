<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  interface Props {
    children?: Snippet;
    align?: 'left' | 'right' | 'center';
    /** Allow the content to wrap (default: single line). */
    wrap?: boolean;
    colspan?: number;
    class?: string;
  }

  let { children, align = 'left', wrap = false, colspan, class: className }: Props = $props();
</script>

<td
  {colspan}
  class={cn(
    'px-3 py-2 align-middle',
    !wrap && 'whitespace-nowrap',
    align === 'right' && 'text-right',
    align === 'center' && 'text-center',
    className,
  )}
>
  {@render children?.()}
</td>
