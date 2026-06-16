'use client';

import { MasterCrudPage } from '@/components/admin/master-crud-page';
import { ADMIN_COLLECTIONS, TEMPLATE_TYPES, RECORD_STATUSES } from '@/lib/admin/constants';
import { emailSmsTemplateSchema } from '@/lib/admin/schemas';
import { StatusBadge } from '@/components/admin/admin-data-table';

export default function EmailSmsTemplatesPage() {
  return (
    <MasterCrudPage
      title="Email/SMS Template Settings"
      description="Manage notification templates for email, SMS, and in-app messaging"
      collection={ADMIN_COLLECTIONS.emailSmsTemplates}
      module="Admin"
      schema={emailSmsTemplateSchema}
      defaultValues={{
        templateCode: '', templateName: '', templateType: 'Email',
        subject: '', body: '', variables: '', module: '', status: 'Active',
      }}
      uniqueFields={[{ field: 'templateCode', label: 'Template Code' }]}
      fields={[
        { name: 'templateCode', label: 'Template Code', required: true },
        { name: 'templateName', label: 'Template Name', required: true },
        { name: 'templateType', label: 'Type', type: 'select', options: TEMPLATE_TYPES.map((t) => ({ label: t, value: t })) },
        { name: 'module', label: 'Module' },
        { name: 'subject', label: 'Subject (Email)' },
        { name: 'variables', label: 'Variables (comma-separated)' },
        { name: 'body', label: 'Template Body', type: 'textarea', colSpan: 2, required: true },
        { name: 'status', label: 'Status', type: 'select', options: RECORD_STATUSES.map((s) => ({ label: s, value: s })) },
      ]}
      columns={[
        { key: 'templateCode', header: 'Code' },
        { key: 'templateName', header: 'Name' },
        { key: 'templateType', header: 'Type', render: (r) => <StatusBadge status={r.templateType} /> },
        { key: 'module', header: 'Module' },
        { key: 'subject', header: 'Subject' },
        { key: 'status', header: 'Status' },
      ]}
    />
  );
}
