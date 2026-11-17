<!--
  Single select of one project's environments (colour dot + name). Disabled
  with a hint while `projectId` is null.

    <EnvironmentSelect {projectId} bind:value={environmentId} />
-->
<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { queryKeys } from '$lib/api';
  import * as Select from '$lib/components/ui/select';
  import { cn, safeHexColor } from '$lib/utils';
  import { environmentsApi } from '../api';

  interface Props {
    projectId: string | null;
    /** Selected environment id. */
    value?: string | null;
    onchange?: (environmentId: string | null) => void;
    placeholder?: string;
    clearable?: boolean;
    disabled?: boolean;
    id?: string;
    'aria-invalid'?: boolean | 'true' | 'false';
    'aria-describedby'?: string;
    'aria-required'?: boolean | 'true' | 'false';
    'aria-label'?: string;
    class?: string;
  }

  let {
    projectId,
    value = $bindable(null),
    onchange,
    placeholder = 'Select an environment',
    clearable = false,
    disabled = false,
    id,
    'aria-invalid': ariaInvalid,
    'aria-describedby': ariaDescribedBy,
    'aria-required': ariaRequired,
    'aria-label': ariaLabel,
    class: className,
  }: Props = $props();

  /** Select item that stands for "no environment" when `clearable`. */
  const NONE = '__none__';

  const environments = createQuery(() => ({
    queryKey: queryKeys.environments.byProject(projectId ?? ''),
    queryFn: ({ signal }) => environmentsApi.listForProject(projectId ?? '', signal),
    enabled: projectId !== null,
  }));

  const items = $derived(projectId === null ? [] : (environments.data ?? []));
  const selected = $derived(items.find((environment) => environment.id === value));

  const hint = $derived.by(() => {
    if (projectId === null) return 'Select a project first';
    if (environments.isPending) return 'Loading environments…';
    if (environments.isError) return 'Could not load environments';
    if (items.length === 0) return 'This project has no environments yet';
    return placeholder;
  });

  const unavailable = $derived(disabled || projectId === null || !environments.isSuccess || items.length === 0);

  function select(next: string) {
    const environmentId = next === NONE || next === '' ? null : next;
    value = environmentId;
    onchange?.(environmentId);
  }
</script>

<Select.Root type="single" value={value ?? ''} onValueChange={select} disabled={unavailable}>
  <Select.Trigger
    {id}
    aria-invalid={ariaInvalid === true || ariaInvalid === 'true' ? 'true' : undefined}
    aria-describedby={ariaDescribedBy}
    aria-required={ariaRequired === true || ariaRequired === 'true' ? 'true' : undefined}
    aria-label={ariaLabel}
    class={cn('w-full', className)}
  >
    {#if selected}
      <span class="flex min-w-0 items-center gap-2">
        <span
          class="size-2 shrink-0 rounded-full"
          style:background-color={safeHexColor(selected.color)}
          aria-hidden="true"
        ></span>
        <span class="truncate">{selected.name}</span>
      </span>
    {:else}
      <span class="text-muted-foreground truncate">{hint}</span>
    {/if}
  </Select.Trigger>
  <Select.Content>
    {#if clearable}
      <Select.Item value={NONE} label={placeholder}>
        <span class="text-muted-foreground">{placeholder}</span>
      </Select.Item>
    {/if}
    {#each items as environment (environment.id)}
      <Select.Item value={environment.id} label={environment.name}>
        <span
          class="size-2 shrink-0 rounded-full"
          style:background-color={safeHexColor(environment.color)}
          aria-hidden="true"
        ></span>
        <span class="truncate">{environment.name}</span>
        {#if environment.server_label}
          <span class="text-muted-foreground truncate font-mono text-xs">{environment.server_label}</span>
        {/if}
      </Select.Item>
    {/each}
  </Select.Content>
</Select.Root>
