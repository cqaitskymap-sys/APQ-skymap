'use client';

import { WarehouseEntityList } from '@/components/warehouse-mgmt/warehouse-entity-list';
import { ReleaseForm } from '@/components/warehouse-mgmt/warehouse-forms';
import { WarehouseStatusBadge } from '@/components/warehouse-mgmt/warehouse-sub-nav';
import { useWarehouse } from '@/hooks/use-warehouse-mgmt';

export default function MaterialReleasePage() {
  const { receipts, releases, loading, refresh } = useWarehouse();

  return (
    <WarehouseEntityList
      title="Material Release"
      description="QA approval to release materials from quarantine to approved storage"
      records={releases as unknown as Record<string, unknown>[]}
      loading={loading}
      onRefresh={refresh}
      renderForm={(props) => <ReleaseForm receipts={receipts} {...props} />}
      columns={[
        { key: 'release_number', label: 'Release No' },
        { key: 'grn_number', label: 'GRN' },
        { key: 'ar_number', label: 'AR No' },
        { key: 'qc_result', label: 'QC Result', render: (r) => <WarehouseStatusBadge status={String(r.qc_result)} /> },
        { key: 'released_quantity', label: 'Released' },
        { key: 'rejected_quantity', label: 'Rejected' },
        { key: 'release_date', label: 'Date' },
        { key: 'approved_by_name', label: 'Approved By' },
        { key: 'status', label: 'Status', render: (r) => <WarehouseStatusBadge status={String(r.status)} /> },
      ]}
    />
  );
}
