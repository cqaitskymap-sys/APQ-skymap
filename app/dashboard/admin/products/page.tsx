'use client';

import { MasterCrudPage } from '@/components/admin/master-crud-page';
import { ADMIN_COLLECTIONS, RECORD_STATUSES } from '@/lib/admin/constants';
import { adminProductSchema } from '@/lib/admin/schemas';

export default function AdminProductsPage() {
  return (
    <MasterCrudPage
      title="Product Master"
      description="Manage pharmaceutical products for PQR, CPV, and batch records"
      collection={ADMIN_COLLECTIONS.products}
      module="Product"
      schema={adminProductSchema}
      defaultValues={{
        productCode: '', productName: '', genericName: '', strength: '',
        dosageForm: '', market: '', shelfLife: '', batchSize: '',
        manufacturingLicenseNo: '', composition: '', packingStyle: '', status: 'Active',
      }}
      uniqueFields={[{ field: 'productCode', label: 'Product Code' }]}
      fields={[
        { name: 'productCode', label: 'Product Code', required: true },
        { name: 'productName', label: 'Product Name', required: true },
        { name: 'genericName', label: 'Generic Name' },
        { name: 'strength', label: 'Strength' },
        { name: 'dosageForm', label: 'Dosage Form' },
        { name: 'market', label: 'Market' },
        { name: 'shelfLife', label: 'Shelf Life' },
        { name: 'batchSize', label: 'Batch Size' },
        { name: 'manufacturingLicenseNo', label: 'Manufacturing License No' },
        { name: 'packingStyle', label: 'Packing Style' },
        { name: 'composition', label: 'Composition', type: 'textarea', colSpan: 2 },
        { name: 'status', label: 'Status', type: 'select', options: RECORD_STATUSES.map((s) => ({ label: s, value: s })) },
      ]}
      columns={[
        { key: 'productCode', header: 'Code' },
        { key: 'productName', header: 'Name' },
        { key: 'strength', header: 'Strength' },
        { key: 'dosageForm', header: 'Dosage Form' },
        { key: 'market', header: 'Market' },
        { key: 'status', header: 'Status' },
      ]}
    />
  );
}
