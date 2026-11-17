<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  let { children, class: className }: { children: Snippet; class?: string } = $props();
</script>

<thead class={cn('bg-muted/40 [&_tr]:border-b [&_tr]:hover:bg-transparent', className)}>
  {@render children()}
</thead>
