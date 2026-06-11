'use client';

import { WarehouseEntityList } from '@/components/warehouse-mgmt/warehouse-entity-list';
import { SamplingForm } from '@/components/warehouse-mgmt/warehouse-forms';
import { WarehouseStatusBadge } from '@/components/warehouse-mgmt/warehouse-sub-nav';
import { useWarehouse } from '@/hooks/use-warehouse-mgmt';

export default function QcSamplingPage() {
  const { receipts, samplings, loading, refresh } = useWarehouse();

  return (
    <WarehouseEntityList
      title="QC Sampling"
      description="Record sample quantities and QC status for quarantined materials"
      records={samplings as unknown as Record<string, unknown>[]}
      loading={loading}
      onRefresh={refresh}
      renderForm={(props) => <SamplingForm receipts={receipts} {...props} />}
      columns={[
        { key: 'sampling_number', label: 'Sampling No' },
        { key: 'grn_number', label: 'GRN' },
        { key: 'material_name', label: 'Material' },
        { key: 'ar_number', label: 'AR No' },
        { key: 'sample_quantity', label: 'Sample Qty' },
        { key: 'sampling_date', label: 'Date' },
        { key: 'sampled_by_name', label: 'Sampled By' },
        { key: 'qc_status', label: 'QC Status', render: (r) => <WarehouseStatusBadge status={String(r.qc_status)} /> },
      ]}
    />
  );
}
