<!-- Tag pill with optional colour and remove button. -->
<script lang="ts">
  import XIcon from '@lucide/svelte/icons/x';
  import { cn } from '$lib/utils/cn';
  import { isHexColor } from '$lib/utils/color';

  interface Props {
    name: string;
    /** Hex colour (`#rrggbb`); ignored when invalid. */
    color?: string | null;
    href?: string;
    /** When set, renders a remove button. */
    onremove?: () => void;
    class?: string;
  }

  let { name, color, href, onremove, class: className }: Props = $props();

  const tint = $derived(isHexColor(color) ? color : null);
  const classes = $derived(
    cn(
      'text-muted-foreground inline-flex h-5 max-w-[24ch] items-center gap-1 rounded-full border px-2 align-middle text-xs',
      href && 'hover:text-foreground hover:bg-muted transition-colors',
      onremove && 'pr-0.5',
      className,
    ),
  );
</script>

{#snippet content()}
  {#if tint}
    <span class="size-1.5 shrink-0 rounded-full" style:background-color={tint} aria-hidden="true"
    ></span>
  {:else}
    <span class="opacity-60" aria-hidden="true">#</span>
  {/if}
  <span class="truncate">{name}</span>
{/snippet}

<span class={classes}>
  {#if href}
    <a {href} class="inline-flex min-w-0 items-center gap-1 rounded-full">{@render content()}</a>
  {:else}
    {@render content()}
  {/if}
  {#if onremove}
    <button
      type="button"
      class="hover:bg-muted hover:text-foreground flex size-4 items-center justify-center rounded-full"
      aria-label={`Remove tag ${name}`}
      onclick={onremove}
    >
      <XIcon class="size-3" aria-hidden="true" />
    </button>
  {/if}
</span>
