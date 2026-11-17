<!--
  Colour choice for tags and environments: curated swatches plus a custom
  `#rrggbb` value. `value` is always what the text box shows, so an invalid
  entry stays visible and is reported by the form's validation.
-->
<script lang="ts">
  import CheckIcon from '@lucide/svelte/icons/check';
  import { Input } from '$lib/components/ui/input';
  import { COLOR_SWATCHES, cn, isHexColor } from '$lib/utils';

  interface Props {
    value: string;
    disabled?: boolean;
    /** Accessible name of the swatch group, e.g. "Environment colour". */
    label?: string;
    id?: string;
    'aria-invalid'?: 'true';
    'aria-describedby'?: string;
  }

  let {
    value = $bindable(),
    disabled = false,
    label = 'Colour',
    id,
    'aria-invalid': ariaInvalid,
    'aria-describedby': ariaDescribedBy,
  }: Props = $props();

  const current = $derived(value.trim().toLowerCase());
</script>

<div class="flex flex-col gap-2">
  <div class="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
    {#each COLOR_SWATCHES as swatch (swatch)}
      {@const checked = current === swatch}
      <button
        type="button"
        role="radio"
        aria-checked={checked}
        aria-label={swatch}
        title={swatch}
        {disabled}
        class={cn(
          'flex size-6 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'border-foreground' : 'hover:border-foreground/50 border-transparent',
        )}
        onclick={() => (value = swatch)}
      >
        <span
          class="flex size-4 items-center justify-center rounded-sm text-white"
          style:background-color={swatch}
        >
          {#if checked}
            <CheckIcon class="size-3" aria-hidden="true" />
          {/if}
        </span>
      </button>
    {/each}
  </div>

  <div class="flex items-center gap-2">
    <span
      class="size-5 shrink-0 rounded-md border"
      style:background-color={isHexColor(current) ? current : 'transparent'}
      aria-hidden="true"
    ></span>
    <Input
      {id}
      bind:value
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedBy}
      aria-label={`${label} as hex value`}
      class="w-28 font-mono"
      maxlength={7}
      placeholder="#22c55e"
      {disabled}
      autocomplete="off"
      autocapitalize="none"
      spellcheck="false"
    />
  </div>
</div>
