'use client';

import { MasterCrudPage } from '@/components/admin/master-crud-page';
import { ADMIN_COLLECTIONS, RECORD_STATUSES } from '@/lib/admin/constants';
import { moduleConfigSchema } from '@/lib/admin/schemas';
import { StatusBadge } from '@/components/admin/admin-data-table';

export default function ModuleConfigurationPage() {
  return (
    <MasterCrudPage
      title="Module Configuration"
      description="Enable, disable, and configure QMS modules across the platform"
      collection={ADMIN_COLLECTIONS.moduleConfiguration}
      module="Admin"
      schema={moduleConfigSchema}
      defaultValues={{
        moduleName: '', moduleCode: '', isEnabled: true, description: '',
        icon: '', route: '', sortOrder: 0, requiredRole: '', status: 'Active',
      }}
      uniqueFields={[{ field: 'moduleCode', label: 'Module Code' }]}
      fields={[
        { name: 'moduleName', label: 'Module Name', required: true },
        { name: 'moduleCode', label: 'Module Code', required: true },
        { name: 'route', label: 'Route Path' },
        { name: 'icon', label: 'Icon Name' },
        { name: 'sortOrder', label: 'Sort Order', type: 'number' },
        { name: 'requiredRole', label: 'Required Role' },
        { name: 'isEnabled', label: 'Enabled', type: 'switch' },
        { name: 'description', label: 'Description', type: 'textarea', colSpan: 2 },
        { name: 'status', label: 'Status', type: 'select', options: RECORD_STATUSES.map((s) => ({ label: s, value: s })) },
      ]}
      columns={[
        { key: 'moduleCode', header: 'Code' },
        { key: 'moduleName', header: 'Module' },
        { key: 'route', header: 'Route' },
        { key: 'isEnabled', header: 'Enabled', render: (r) => <StatusBadge status={r.isEnabled ? 'Active' : 'Inactive'} /> },
        { key: 'sortOrder', header: 'Order' },
        { key: 'status', header: 'Status' },
      ]}
    />
  );
}
