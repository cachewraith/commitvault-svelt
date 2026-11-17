<!--
  From/to day pickers for list filters. Values are RFC 3339 UTC strings:
  `from` is 00:00:00.000 and `to` is 23:59:59.999 of the chosen local day, so
  they can be sent to the API (`date_from` / `date_to`) unchanged.

    <DateRangeFilter from={from.value} to={to.value}
      onchange={(range) => setQuery({ date_from: range.from, date_to: range.to, page: null })} />
-->
<script lang="ts" module>
  export interface DateRange {
    from: string | null;
    to: string | null;
  }
</script>

<script lang="ts">
  import { cn } from '$lib/utils/cn';
  import { endOfLocalDayIso, startOfLocalDayIso, toDateInputValue } from '$lib/utils/format';

  interface Props {
    /** ISO start instant, or empty. */
    from?: string | null;
    /** ISO end instant, or empty. */
    to?: string | null;
    onchange: (range: DateRange) => void;
    /** Describes what the range filters, e.g. "Commit date". */
    label?: string;
    disabled?: boolean;
    class?: string;
  }

  let { from = null, to = null, onchange, label = 'Date', disabled = false, class: className }: Props =
    $props();

  const uid = $props.id();
  const fromDay = $derived(toDateInputValue(from));
  const toDay = $derived(toDateInputValue(to));

  function changeFrom(event: Event) {
    const day = (event.currentTarget as HTMLInputElement).value;
    onchange({ from: day ? startOfLocalDayIso(day) : null, to: to || null });
  }

  function changeTo(event: Event) {
    const day = (event.currentTarget as HTMLInputElement).value;
    onchange({ from: from || null, to: day ? endOfLocalDayIso(day) : null });
  }

  const inputClass =
    'border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-8 rounded-lg border bg-transparent px-2 text-sm outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 tabular';
</script>

<fieldset class={cn('flex items-end gap-1.5', className)} {disabled}>
  <legend class="sr-only">{label} range</legend>
  <div class="flex flex-col gap-1">
    <label for={`${uid}-from`} class="eyebrow">{label} from</label>
    <input
      id={`${uid}-from`}
      type="date"
      class={inputClass}
      value={fromDay}
      max={toDay || undefined}
      onchange={changeFrom}
    />
  </div>
  <span class="text-muted-foreground pb-1.5 text-xs" aria-hidden="true">–</span>
  <div class="flex flex-col gap-1">
    <label for={`${uid}-to`} class="eyebrow">to</label>
    <input
      id={`${uid}-to`}
      type="date"
      class={inputClass}
      value={toDay}
      min={fromDay || undefined}
      onchange={changeTo}
    />
  </div>
</fieldset>
