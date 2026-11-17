<script lang="ts">
  import type { SortOrder } from '$lib/api/types';
  import { DataTable, DataTableHead, DataTableHeader, DataTableRow } from '../../data-table';

  let {
    sort,
    order,
    onsort,
  }: { sort: string; order: SortOrder; onsort: (sort: string, order: SortOrder) => void } = $props();
</script>

<DataTable label="Commits">
  <DataTableHeader>
    <DataTableRow>
      <DataTableHead sortKey="commit_date" {sort} {order} {onsort}>Date</DataTableHead>
      <DataTableHead sortKey="branch_name" {sort} {order} {onsort} defaultOrder="asc">Branch</DataTableHead>
      <DataTableHead>Message</DataTableHead>
    </DataTableRow>
  </DataTableHeader>
</DataTable>
