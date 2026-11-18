<!-- Full-page view of one recorded commit (the same view opens in the commit list's side panel). -->
<script lang="ts">
  import CommitDetail from '../components/CommitDetail.svelte';

  let { commitId }: { commitId: string } = $props();
</script>

<div class="page">
  <CommitDetail {commitId} layout="page" />
</div>
