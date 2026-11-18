<!-- Environment name with its user-chosen colour dot — text, not a box. Colours are validated hex literals. -->
<script lang="ts">
  import { cn } from '$lib/utils/cn';
  import { safeHexColor } from '$lib/utils/color';

  interface Props {
    name: string;
    /** Hex colour (`#rrggbb`); anything else falls back to neutral. */
    color?: string | null;
    href?: string;
    size?: 'sm' | 'md';
    class?: string;
  }

  let { name, color, href, size = 'sm', class: className }: Props = $props();

  const dot = $derived(safeHexColor(color));
  const classes = $derived(
    cn(
      'text-foreground inline-flex max-w-[24ch] items-center gap-1.5 align-middle',
      size === 'sm' ? 'text-xs' : 'text-sm',
      href && 'hover:underline underline-offset-2',
      className,
    ),
  );
</script>

{#snippet content()}
  <span class="size-2 shrink-0 rounded-full" style:background-color={dot} aria-hidden="true"></span>
  <span class="truncate">{name}</span>
{/snippet}

{#if href}
  <a {href} class={classes}>{@render content()}</a>
{:else}
  <span class={classes}>{@render content()}</span>
{/if}
