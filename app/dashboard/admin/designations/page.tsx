'use client';

import { MasterCrudPage } from '@/components/admin/master-crud-page';
import { ADMIN_COLLECTIONS, RECORD_STATUSES } from '@/lib/admin/constants';
import { designationSchema } from '@/lib/admin/schemas';

export default function DesignationsPage() {
  return (
    <MasterCrudPage
      title="Designation Master"
      description="Manage job designations and approval levels"
      collection={ADMIN_COLLECTIONS.designations}
      module="Admin"
      schema={designationSchema}
      defaultValues={{ designationCode: '', designationName: '', department: '', approvalLevel: 1, status: 'Active' }}
      uniqueFields={[{ field: 'designationCode', label: 'Designation Code' }]}
      fields={[
        { name: 'designationCode', label: 'Designation Code', required: true },
        { name: 'designationName', label: 'Designation Name', required: true },
        { name: 'department', label: 'Department', required: true },
        { name: 'approvalLevel', label: 'Approval Level', type: 'number' },
        { name: 'status', label: 'Status', type: 'select', options: RECORD_STATUSES.map((s) => ({ label: s, value: s })) },
      ]}
      columns={[
        { key: 'designationCode', header: 'Code' },
        { key: 'designationName', header: 'Name' },
        { key: 'department', header: 'Department' },
        { key: 'approvalLevel', header: 'Level' },
        { key: 'status', header: 'Status' },
      ]}
    />
  );
}
