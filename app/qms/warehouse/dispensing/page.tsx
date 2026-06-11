'use client';

import { WarehouseEntityList } from '@/components/warehouse-mgmt/warehouse-entity-list';
import { DispensingForm } from '@/components/warehouse-mgmt/warehouse-forms';
import { WarehouseStatusBadge } from '@/components/warehouse-mgmt/warehouse-sub-nav';
import { useWarehouse } from '@/hooks/use-warehouse-mgmt';
import { exportDispensingCsv } from '@/lib/warehouse-mgmt-service';

export default function MaterialDispensingPage() {
  const { inventory, dispensing, loading, refresh } = useWarehouse();

  return (
    <WarehouseEntityList
      title="Material Dispensing"
      description="Dispense approved materials to production batches with FIFO/FEFO and quantity validation"
      records={dispensing as unknown as Record<string, unknown>[]}
      loading={loading}
      onRefresh={refresh}
      exportFn={() => exportDispensingCsv(dispensing)}
      renderForm={(props) => <DispensingForm inventory={inventory} {...props} />}
      columns={[
        { key: 'dispensing_number', label: 'Dispensing No' },
        { key: 'dispensing_date', label: 'Date' },
        { key: 'product_name', label: 'Product' },
        { key: 'batch_number', label: 'Batch' },
        { key: 'material_name', label: 'Material' },
        { key: 'ar_number', label: 'AR No' },
        { key: 'dispensed_quantity', label: 'Dispensed' },
        { key: 'balance_quantity', label: 'Balance' },
        { key: 'status', label: 'Status', render: (r) => <WarehouseStatusBadge status={String(r.status)} /> },
      ]}
    />
  );
}
