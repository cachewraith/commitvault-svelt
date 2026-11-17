<!-- Compact select for list filters and sort choices (a labelled shadcn Select). -->
<script lang="ts" generics="T extends string">
  import * as Select from '$lib/components/ui/select';
  import { cn } from '$lib/utils';

  interface Option {
    value: T;
    label: string;
  }

  interface Props {
    options: readonly Option[];
    value: T;
    onchange: (value: T) => void;
    /** Accessible name, e.g. "Status". Also shown as a prefix in the trigger. */
    label: string;
    disabled?: boolean;
    class?: string;
  }

  let { options, value, onchange, label, disabled = false, class: className }: Props = $props();

  const current = $derived(options.find((option) => option.value === value));
</script>

<Select.Root type="single" {value} onValueChange={(next) => onchange(next as T)} {disabled}>
  <Select.Trigger aria-label={label} class={cn('min-w-36', className)}>
    <span class="truncate">
      <span class="text-muted-foreground">{label}:</span>
      {current?.label ?? '—'}
    </span>
  </Select.Trigger>
  <Select.Content>
    {#each options as option (option.value)}
      <Select.Item value={option.value} label={option.label} />
    {/each}
  </Select.Content>
</Select.Root>
