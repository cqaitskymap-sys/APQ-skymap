'use client';

import { WarehouseEntityList } from '@/components/warehouse-mgmt/warehouse-entity-list';
import { FinishedGoodsForm } from '@/components/warehouse-mgmt/warehouse-forms';
import { WarehouseStatusBadge } from '@/components/warehouse-mgmt/warehouse-sub-nav';
import { useWarehouse } from '@/hooks/use-warehouse-mgmt';

export default function FinishedGoodsPage() {
  const { finishedGoods, loading, refresh } = useWarehouse();

  return (
    <WarehouseEntityList
      title="Finished Goods"
      description="Track FG batches from packing through release and dispatch"
      records={finishedGoods as unknown as Record<string, unknown>[]}
      loading={loading}
      onRefresh={refresh}
      renderForm={(props) => <FinishedGoodsForm {...props} />}
      columns={[
        { key: 'fg_batch_number', label: 'FG Batch' },
        { key: 'product_name', label: 'Product' },
        { key: 'mfg_date', label: 'MFG' },
        { key: 'exp_date', label: 'EXP' },
        { key: 'packed_quantity', label: 'Packed' },
        { key: 'released_quantity', label: 'Released' },
        { key: 'dispatch_quantity', label: 'Dispatched' },
        { key: 'balance_quantity', label: 'Balance' },
        { key: 'customer', label: 'Customer' },
        { key: 'status', label: 'Status', render: (r) => <WarehouseStatusBadge status={String(r.status)} /> },
      ]}
    />
  );
}
