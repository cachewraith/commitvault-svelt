<!-- Full-page view of one release (the same view opens in the release list's side panel). -->
<script lang="ts">
  import ReleaseDetail from '../components/ReleaseDetail.svelte';

  let { releaseId }: { releaseId: string } = $props();
</script>

<div class="page">
  <ReleaseDetail {releaseId} layout="page" />
</div>
