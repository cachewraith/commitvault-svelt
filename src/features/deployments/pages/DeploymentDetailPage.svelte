<!-- Full-page view of one deployment record (the same view opens in the history's side panel). -->
<script lang="ts">
  import DeploymentDetail from '../components/DeploymentDetail.svelte';

  let { deploymentId }: { deploymentId: string } = $props();
</script>

<div class="page">
  <DeploymentDetail {deploymentId} layout="page" />
</div>
