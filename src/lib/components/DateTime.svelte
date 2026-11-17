<!--
  Timestamp as a semantic <time>. Shows relative time by default with the full
  date in the tooltip; `mode` switches the visible form.
-->
<script lang="ts">
  import { cn } from '$lib/utils/cn';
  import {
    formatDate,
    formatDateTime,
    formatFull,
    formatRelative,
    toDate,
    type DateInput,
  } from '$lib/utils/format';

  interface Props {
    value: DateInput;
    /** relative: "3 hours ago" · date: "Nov 17, 2026" · datetime: "Nov 17, 2026, 2:14 PM" · both: "Nov 17, 2026 · 3 hours ago" */
    mode?: 'relative' | 'date' | 'datetime' | 'both';
    /** Text when the value is missing. */
    fallback?: string;
    class?: string;
  }

  let { value, mode = 'relative', fallback = '—', class: className }: Props = $props();

  const date = $derived(toDate(value));
  const text = $derived.by(() => {
    if (!date) return fallback;
    switch (mode) {
      case 'date':
        return formatDate(date);
      case 'datetime':
        return formatDateTime(date);
      case 'both':
        return `${formatDateTime(date)} · ${formatRelative(date)}`;
      default:
        return formatRelative(date);
    }
  });
</script>

{#if date}
  <time datetime={date.toISOString()} title={formatFull(date)} class={cn('tabular whitespace-nowrap', className)}>
    {text}
  </time>
{:else}
  <span class={cn('text-muted-foreground', className)}>{text}</span>
{/if}
