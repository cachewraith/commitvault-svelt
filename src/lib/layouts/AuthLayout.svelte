<!-- Bare, centred layout for signed-out screens (login) and standalone error pages. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

<main id="main-content" class="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
  {@render children()}
</main>
