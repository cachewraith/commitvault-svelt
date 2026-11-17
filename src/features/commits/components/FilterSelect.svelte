<!--
  Compact single select for list filters backed by a fixed set of values
  (status, recorded-deployment state). The first entry clears the filter.
-->
<script lang="ts" generics="T extends string">
  import * as Select from '$lib/components/ui/select';
  import { cn } from '$lib/utils/cn';

  interface Props {
    /** Selected value; `undefined` = no filter. */
    value: T | undefined;
    options: readonly { value: T; label: string }[];
    onchange: (value: T | undefined) => void;
    /** Accessible name, e.g. "Deployment status". */
    label: string;
    /** Label of the entry that clears the filter. */
    allLabel: string;
    class?: string;
  }

  let { value, options, onchange, label, allLabel, class: className }: Props = $props();

  const ALL = '__all__';
  const current = $derived(options.find((option) => option.value === value));
</script>

<Select.Root
  type="single"
  value={value ?? ALL}
  onValueChange={(next) => onchange(next === ALL || next === '' ? undefined : (next as T))}
>
  <Select.Trigger aria-label={label} class={cn('w-full sm:w-52', !current && 'text-muted-foreground', className)}>
    <span class="truncate">{current?.label ?? allLabel}</span>
  </Select.Trigger>
  <Select.Content>
    <Select.Item value={ALL} label={allLabel} />
    {#each options as option (option.value)}
      <Select.Item value={option.value} label={option.label} />
    {/each}
  </Select.Content>
</Select.Root>
