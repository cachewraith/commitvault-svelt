<!-- Full-page project overview (the same view opens in the side panel from any project link). -->
<script lang="ts">
  import ProjectDetail from '../components/ProjectDetail.svelte';

  let { projectId }: { projectId: string } = $props();
</script>

<div class="page">
  <ProjectDetail {projectId} layout="page" />
</div>
