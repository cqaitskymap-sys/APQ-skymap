'use client';

import { WarehouseEntityList } from '@/components/warehouse-mgmt/warehouse-entity-list';
import { ReceiptForm } from '@/components/warehouse-mgmt/warehouse-forms';
import { WarehouseStatusBadge } from '@/components/warehouse-mgmt/warehouse-sub-nav';
import { useWarehouse } from '@/hooks/use-warehouse-mgmt';
import { exportReceiptsCsv } from '@/lib/warehouse-mgmt-service';

export default function MaterialReceiptPage() {
  const { receipts, loading, refresh } = useWarehouse();

  return (
    <WarehouseEntityList
      title="Material Receipt"
      description="Create GRN for API, raw material, excipient, and packing materials with vendor validation"
      records={receipts as unknown as Record<string, unknown>[]}
      loading={loading}
      onRefresh={refresh}
      exportFn={() => exportReceiptsCsv(receipts)}
      renderForm={(props) => <ReceiptForm {...props} />}
      columns={[
        { key: 'grn_number', label: 'GRN No' },
        { key: 'receipt_date', label: 'Date' },
        { key: 'material_name', label: 'Material' },
        { key: 'material_type', label: 'Type' },
        { key: 'vendor_name', label: 'Vendor' },
        { key: 'ar_number', label: 'AR No' },
        { key: 'batch_lot_number', label: 'Lot' },
        { key: 'received_quantity', label: 'Qty', render: (r) => `${r.received_quantity} ${r.unit || ''}` },
        { key: 'status', label: 'Status', render: (r) => <WarehouseStatusBadge status={String(r.status)} /> },
      ]}
    />
  );
}
