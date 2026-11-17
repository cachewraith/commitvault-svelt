<script lang="ts">
  import FormField from '../../FormField.svelte';

  let { error = null, hint, required = false }: { error?: string | null; hint?: string; required?: boolean } =
    $props();
</script>

<FormField label="Project name" {error} {hint} {required}>
  {#snippet children(field)}
    <input {...field} />
  {/snippet}
</FormField>
