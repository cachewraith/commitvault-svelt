<!-- Full-page branch view (the same view opens in the side panel from any branch link). -->
<script lang="ts">
  import BranchDetail from '../components/BranchDetail.svelte';

  let { branchId }: { branchId: string } = $props();
</script>

<div class="page">
  <BranchDetail {branchId} layout="page" />
</div>
