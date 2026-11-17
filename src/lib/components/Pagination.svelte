<!--
  Pager bound to a list response's `meta`.
    <Pagination meta={query.data.meta} onchange={(page) => (pageParam.value = page)} />
  Renders nothing when there is a single page and `hideWhenSinglePage` is set.
-->
<script lang="ts">
  import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import { Button } from '$lib/components/ui/button';
  import type { PageMeta } from '$lib/api/types';
  import { cn } from '$lib/utils/cn';
  import { formatNumber } from '$lib/utils/format';

  interface Props {
    meta: PageMeta;
    onchange: (page: number) => void;
    /** Noun for the range summary, e.g. "commits". */
    label?: string;
    disabled?: boolean;
    hideWhenSinglePage?: boolean;
    class?: string;
  }

  let {
    meta,
    onchange,
    label = 'results',
    disabled = false,
    hideWhenSinglePage = false,
    class: className,
  }: Props = $props();

  const totalPages = $derived(Math.max(1, meta.total_pages));
  const page = $derived(Math.min(Math.max(1, meta.page), totalPages));
  const first = $derived(meta.total === 0 ? 0 : (page - 1) * meta.per_page + 1);
  const last = $derived(Math.min(page * meta.per_page, meta.total));

  /** Page numbers with `null` gaps: 1 … 4 5 6 … 20 */
  const pages = $derived.by(() => {
    const result: Array<number | null> = [];
    const windowStart = Math.max(2, page - 1);
    const windowEnd = Math.min(totalPages - 1, page + 1);
    result.push(1);
    if (windowStart > 2) result.push(null);
    for (let p = windowStart; p <= windowEnd; p++) result.push(p);
    if (windowEnd < totalPages - 1) result.push(null);
    if (totalPages > 1) result.push(totalPages);
    return result;
  });

  function go(target: number) {
    if (disabled || target < 1 || target > totalPages || target === page) return;
    onchange(target);
  }
</script>

{#if !(hideWhenSinglePage && totalPages <= 1)}
  <nav
    aria-label="Pagination"
    class={cn('flex flex-col items-center justify-between gap-3 sm:flex-row', className)}
  >
    <p class="text-muted-foreground tabular text-xs" aria-live="polite">
      {#if meta.total === 0}
        No {label}
      {:else}
        <span class="text-foreground font-medium">{formatNumber(first)}–{formatNumber(last)}</span>
        of
        <span class="text-foreground font-medium">{formatNumber(meta.total)}</span>
        {label}
      {/if}
    </p>

    {#if totalPages > 1}
      <ul class="flex items-center gap-1">
        <li>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous page"
            disabled={disabled || page <= 1}
            onclick={() => go(page - 1)}
          >
            <ChevronLeftIcon aria-hidden="true" />
          </Button>
        </li>
        {#each pages as item, index (index)}
          <li class="hidden sm:block">
            {#if item === null}
              <span class="text-muted-foreground px-1.5 text-xs" aria-hidden="true">…</span>
            {:else}
              <Button
                variant={item === page ? 'secondary' : 'ghost'}
                size="sm"
                class="tabular min-w-7 px-2"
                aria-label={`Page ${item}`}
                aria-current={item === page ? 'page' : undefined}
                {disabled}
                onclick={() => go(item)}
              >
                {item}
              </Button>
            {/if}
          </li>
        {/each}
        <li class="text-muted-foreground tabular px-2 text-xs sm:hidden">
          {page} / {totalPages}
        </li>
        <li>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next page"
            disabled={disabled || page >= totalPages}
            onclick={() => go(page + 1)}
          >
            <ChevronRightIcon aria-hidden="true" />
          </Button>
        </li>
      </ul>
    {/if}
  </nav>
{/if}
