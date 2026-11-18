<!--
  Compact, read-only list of notes for embedding (project overview, dashboard).
  Renders nothing when empty — the parent owns the empty state.
-->
<script lang="ts">
  import PinIcon from '@lucide/svelte/icons/pin';
  import { DateTime } from '$lib/components';
  import { paths } from '$routes/paths';
  import type { Note } from '../types';

  interface Props {
    notes: Note[];
    /** Show the project name, or "Global" (cross-project lists). */
    showProject?: boolean;
    label?: string;
  }

  let { notes, showProject = false, label = 'Notes' }: Props = $props();
</script>

{#if notes.length > 0}
  <ul aria-label={label} class="divide-y">
    {#each notes as note (note.id)}
      <li class="animate-enter flex items-start gap-3 py-2 text-sm">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5">
            {#if note.is_pinned}
              <PinIcon class="text-brand size-3.5 shrink-0" aria-hidden="true" />
              <span class="sr-only">Pinned.</span>
            {/if}
            <a href={paths.note(note.id)} class="text-foreground truncate font-medium hover:underline">
              {note.title}
            </a>
          </div>
          {#if note.excerpt}
            <p class="text-muted-foreground mt-0.5 line-clamp-1 text-xs">{note.excerpt}</p>
          {/if}
          {#if showProject || note.category}
            <p class="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 text-xs">
              {#if showProject}
                {#if note.project}
                  <a href={paths.project(note.project.id)} class="hover:text-foreground max-w-[24ch] truncate">
                    {note.project.name}
                  </a>
                {:else}
                  <span>Global</span>
                {/if}
              {/if}
              {#if note.category}
                <span class="bg-muted rounded-md px-1.5 py-px">{note.category}</span>
              {/if}
            </p>
          {/if}
        </div>
        <DateTime value={note.updated_at} class="text-muted-foreground tabular shrink-0 text-xs" />
      </li>
    {/each}
  </ul>
{/if}
