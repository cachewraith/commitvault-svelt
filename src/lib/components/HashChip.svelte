<!--
  Commit hash in monospace, as plain text — no box. `copyable` adds a copy
  button (the full hash is copied); `href` makes the hash an in-app link;
  `externalUrl` adds a link to the commit on the Git host. Lists keep it bare;
  detail views opt into the buttons.
-->
<script lang="ts">
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
  import CopyButton from './CopyButton.svelte';
  import { cn } from '$lib/utils/cn';
  import { shortHash } from '$lib/utils/hash';
  import { safeExternalUrl } from '$lib/utils/url';

  interface Props {
    /** Full commit hash. */
    hash: string;
    /** Display text; defaults to the first 7 characters of `hash`. */
    short?: string | null;
    /** Show the full hash instead of the abbreviation. */
    full?: boolean;
    /** In-app link target (e.g. the commit detail page). */
    href?: string;
    /** Commit URL on the Git host; only http(s) URLs are rendered. */
    externalUrl?: string | null;
    copyable?: boolean;
    class?: string;
  }

  let {
    hash,
    short,
    full = false,
    href,
    externalUrl,
    copyable = false,
    class: className,
  }: Props = $props();

  const display = $derived(full ? hash : short || shortHash(hash));
  const external = $derived(safeExternalUrl(externalUrl));
</script>

<span class={cn('inline-flex max-w-full items-center gap-0.5 align-middle', className)}>
  {#if href}
    <a {href} class="text-muted-foreground hover:text-foreground truncate font-mono text-xs" title={hash}>
      {display}
    </a>
  {:else}
    <code class="text-muted-foreground truncate font-mono text-xs" title={hash}>{display}</code>
  {/if}
  {#if copyable}
    <CopyButton value={hash} label="Copy commit hash" class="size-5" />
  {/if}
  {#if external}
    <a
      href={external}
      target="_blank"
      rel="noopener noreferrer"
      class="text-muted-foreground hover:text-foreground flex size-5 items-center justify-center rounded-sm"
      aria-label="Open commit on Git host (opens in a new tab)"
      title="Open on Git host"
    >
      <ExternalLinkIcon class="size-3" aria-hidden="true" />
    </a>
  {/if}
</span>
