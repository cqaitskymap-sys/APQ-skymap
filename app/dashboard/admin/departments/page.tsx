'use client';

import { MasterCrudPage } from '@/components/admin/master-crud-page';
import { ADMIN_COLLECTIONS, RECORD_STATUSES } from '@/lib/admin/constants';
import { departmentSchema } from '@/lib/admin/schemas';

export default function DepartmentsPage() {
  return (
    <MasterCrudPage
      title="Department Master"
      description="Manage organizational departments for QMS workflow routing"
      collection={ADMIN_COLLECTIONS.departments}
      module="Admin"
      schema={departmentSchema}
      defaultValues={{ departmentCode: '', departmentName: '', departmentHead: '', description: '', status: 'Active' }}
      uniqueFields={[{ field: 'departmentCode', label: 'Department Code' }]}
      fields={[
        { name: 'departmentCode', label: 'Department Code', required: true },
        { name: 'departmentName', label: 'Department Name', required: true },
        { name: 'departmentHead', label: 'Department Head' },
        { name: 'description', label: 'Description', type: 'textarea', colSpan: 2 },
        { name: 'status', label: 'Status', type: 'select', options: RECORD_STATUSES.map((s) => ({ label: s, value: s })) },
      ]}
      columns={[
        { key: 'departmentCode', header: 'Code' },
        { key: 'departmentName', header: 'Name' },
        { key: 'departmentHead', header: 'Head' },
        { key: 'status', header: 'Status' },
      ]}
    />
  );
}
