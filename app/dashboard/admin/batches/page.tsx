'use client';

import { MasterCrudPage } from '@/components/admin/master-crud-page';
import { ADMIN_COLLECTIONS, RECORD_STATUSES } from '@/lib/admin/constants';
import { adminBatchSchema } from '@/lib/admin/schemas';

export default function AdminBatchesPage() {
  return (
    <MasterCrudPage
      title="Batch Master"
      description="Manage manufacturing batch records linked to products"
      collection={ADMIN_COLLECTIONS.batches}
      module="Batch"
      schema={adminBatchSchema}
      defaultValues={{
        batchNumber: '', productCode: '', productName: '', manufacturingDate: '',
        expiryDate: '', batchSize: '', unit: '', lineNumber: '', batchStatus: 'In Process', status: 'Active',
      }}
      uniqueFields={[{ field: 'batchNumber', label: 'Batch Number' }]}
      fields={[
        { name: 'batchNumber', label: 'Batch Number', required: true },
        { name: 'productCode', label: 'Product Code', required: true },
        { name: 'productName', label: 'Product Name' },
        { name: 'manufacturingDate', label: 'Manufacturing Date', type: 'date' },
        { name: 'expiryDate', label: 'Expiry Date', type: 'date' },
        { name: 'batchSize', label: 'Batch Size' },
        { name: 'unit', label: 'Unit' },
        { name: 'lineNumber', label: 'Line Number' },
        { name: 'batchStatus', label: 'Batch Status', type: 'select', options: [
          { label: 'In Process', value: 'In Process' },
          { label: 'Released', value: 'Released' },
          { label: 'Rejected', value: 'Rejected' },
          { label: 'Quarantine', value: 'Quarantine' },
        ]},
        { name: 'status', label: 'Status', type: 'select', options: RECORD_STATUSES.map((s) => ({ label: s, value: s })) },
      ]}
      columns={[
        { key: 'batchNumber', header: 'Batch No' },
        { key: 'productCode', header: 'Product' },
        { key: 'manufacturingDate', header: 'Mfg Date' },
        { key: 'expiryDate', header: 'Expiry' },
        { key: 'batchStatus', header: 'Batch Status' },
        { key: 'status', header: 'Status' },
      ]}
    />
  );
}
