<!-- Git branch name: monospace, branch icon, tinted with the accent so it never reads as a status. -->
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
      'border-brand/25 bg-brand/10 text-brand inline-flex h-5 max-w-[28ch] items-center gap-1 rounded-md border px-1.5 align-middle font-mono text-xs',
      href && 'hover:bg-brand/20 transition-colors',
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
