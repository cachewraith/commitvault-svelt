<!-- Git branch name: monospace with a branch icon, quiet text rather than a coloured pill. -->
<script lang="ts">
  import GitBranchIcon from '@lucide/svelte/icons/git-branch';
  import { cn } from '$lib/utils/cn';

  interface Props {
    name: string;
    /** Optional link (e.g. commits filtered by this branch). */
    href?: string;
    class?: string;
  }

  let { name, href, class: className }: Props = $props();

  const classes = $derived(
    cn(
      'text-muted-foreground inline-flex max-w-[28ch] items-center gap-1 align-middle font-mono text-xs',
      href && 'hover:text-foreground transition-colors',
      className,
    ),
  );
</script>

{#snippet content()}
  <GitBranchIcon class="size-3 shrink-0" aria-hidden="true" />
  <span class="truncate">{name}</span>
{/snippet}

{#if href}
  <a {href} class={classes} title={`Branch ${name}`}>{@render content()}</a>
{:else}
  <span class={classes} title={`Branch ${name}`}>
    <span class="sr-only">Branch</span>
    {@render content()}
  </span>
{/if}
