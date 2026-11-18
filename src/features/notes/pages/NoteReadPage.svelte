<!-- Full-page reading view of a note (the same view opens in the side panel from any note link). -->
<script lang="ts">
  import NoteDetail from '../components/NoteDetail.svelte';

  let { noteId }: { noteId: string } = $props();
</script>

<div class="page">
  <NoteDetail {noteId} layout="page" />
</div>
