<!--
  Stand-in for the pickers owned by other features (project, environment, tag)
  in unit tests: a plain text input that reports its value through `onchange`,
  so tests exercise this feature's forms without the other features' network calls.
-->
<script lang="ts">
  interface Props {
    value?: string | null;
    values?: string[];
    onchange?: (value: string | null) => void;
    id?: string;
    placeholder?: string;
    'aria-invalid'?: boolean | 'true' | 'false';
    'aria-describedby'?: string;
    [key: string]: unknown;
  }

  let {
    value = $bindable(null),
    values = $bindable([]),
    onchange,
    id,
    placeholder,
    'aria-invalid': ariaInvalid,
    'aria-describedby': ariaDescribedBy,
  }: Props = $props();

  void values;
</script>

<input
  {id}
  aria-label={id ? undefined : placeholder}
  aria-invalid={ariaInvalid === true || ariaInvalid === 'true' ? 'true' : undefined}
  aria-describedby={ariaDescribedBy}
  value={value ?? ''}
  oninput={(event) => {
    value = event.currentTarget.value || null;
    onchange?.(value);
  }}
/>
