'use client';

import { MasterCrudPage } from '@/components/admin/master-crud-page';
import { ADMIN_COLLECTIONS, RECORD_STATUSES } from '@/lib/admin/constants';
import { documentNumberingSchema } from '@/lib/admin/schemas';

export default function DocumentNumberingPage() {
  return (
    <MasterCrudPage
      title="Document Numbering"
      description="Configure auto-numbering formats for QMS documents"
      collection={ADMIN_COLLECTIONS.documentNumbering}
      module="Document"
      schema={documentNumberingSchema}
      defaultValues={{
        module: 'PQR', prefix: 'PQR', siteCode: 'HMF', departmentCode: '0041',
        yearFormat: 'YYYY', runningNumber: 4, separator: '/',
        exampleFormat: 'PQR/HMF-0041/040/2025', currentNumber: 0,
        resetFrequency: 'Yearly', status: 'Active',
      }}
      uniqueFields={[{ field: 'prefix', label: 'Prefix' }]}
      fields={[
        { name: 'module', label: 'Module', required: true },
        { name: 'prefix', label: 'Prefix', required: true },
        { name: 'siteCode', label: 'Site Code' },
        { name: 'departmentCode', label: 'Department Code' },
        { name: 'yearFormat', label: 'Year Format' },
        { name: 'runningNumber', label: 'Running Number Digits', type: 'number' },
        { name: 'separator', label: 'Separator' },
        { name: 'exampleFormat', label: 'Example Format', colSpan: 2 },
        { name: 'currentNumber', label: 'Current Number', type: 'number' },
        { name: 'resetFrequency', label: 'Reset Frequency', type: 'select', options: [
          { label: 'Never', value: 'Never' },
          { label: 'Yearly', value: 'Yearly' },
          { label: 'Monthly', value: 'Monthly' },
        ]},
        { name: 'status', label: 'Status', type: 'select', options: RECORD_STATUSES.map((s) => ({ label: s, value: s })) },
      ]}
      columns={[
        { key: 'module', header: 'Module' },
        { key: 'prefix', header: 'Prefix' },
        { key: 'exampleFormat', header: 'Format' },
        { key: 'currentNumber', header: 'Current No' },
        { key: 'resetFrequency', header: 'Reset' },
        { key: 'status', header: 'Status' },
      ]}
    />
  );
}
