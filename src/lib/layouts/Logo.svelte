<!-- CommitVault mark (commit graph) with optional wordmark. -->
<script lang="ts">
  import { cn } from '$lib/utils/cn';

  interface Props {
    /** Show the "CommitVault" wordmark next to the mark. */
    wordmark?: boolean;
    class?: string;
  }

  let { wordmark = true, class: className }: Props = $props();
</script>

<span class={cn('inline-flex items-center gap-2', className)}>
  <svg viewBox="0 0 24 24" fill="none" class="size-5 shrink-0" aria-hidden="true">
    <path d="M7 6v12" class="stroke-muted-foreground" stroke-width="1.75" stroke-linecap="round" />
    <path
      d="M17 12.5c0 3.2-4.6 2-8 4.4"
      class="stroke-brand"
      stroke-width="1.75"
      stroke-linecap="round"
    />
    <circle cx="7" cy="6" r="2.25" class="fill-background stroke-foreground" stroke-width="1.75" />
    <circle cx="7" cy="18" r="2.25" class="fill-background stroke-foreground" stroke-width="1.75" />
    <circle cx="17" cy="10.25" r="2.25" class="fill-background stroke-brand" stroke-width="1.75" />
  </svg>
  {#if wordmark}
    <span class="text-foreground text-sm font-semibold tracking-tight">CommitVault</span>
  {/if}
</span>
