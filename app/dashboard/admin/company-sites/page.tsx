'use client';

import { MasterCrudPage } from '@/components/admin/master-crud-page';
import { ADMIN_COLLECTIONS, RECORD_STATUSES } from '@/lib/admin/constants';
import { companySiteSchema } from '@/lib/admin/schemas';

export default function CompanySitesPage() {
  return (
    <MasterCrudPage
      title="Company / Site Master"
      description="Company and site information used in PQR, CPV, and QMS report headers"
      collection={ADMIN_COLLECTIONS.companySites}
      module="Admin"
      schema={companySiteSchema}
      defaultValues={{
        companyName: '', companyLogo: '', siteName: '', plantAddress: '', city: '',
        state: '', country: '', licenseNo: '', gstNo: '', contactEmail: '',
        contactNumber: '', defaultTimezone: 'Asia/Kolkata', documentHeaderFormat: '',
        isDefault: false, status: 'Active',
      }}
      fields={[
        { name: 'companyName', label: 'Company Name', required: true, colSpan: 2 },
        { name: 'siteName', label: 'Site Name', required: true },
        { name: 'companyLogo', label: 'Company Logo URL' },
        { name: 'plantAddress', label: 'Plant Address', type: 'textarea', colSpan: 2 },
        { name: 'city', label: 'City' },
        { name: 'state', label: 'State' },
        { name: 'country', label: 'Country' },
        { name: 'licenseNo', label: 'License No' },
        { name: 'gstNo', label: 'GST No' },
        { name: 'contactEmail', label: 'Contact Email', type: 'email' },
        { name: 'contactNumber', label: 'Contact Number' },
        { name: 'defaultTimezone', label: 'Default Timezone' },
        { name: 'documentHeaderFormat', label: 'Document Header Format', colSpan: 2 },
        { name: 'isDefault', label: 'Default Site', type: 'switch' },
        { name: 'status', label: 'Status', type: 'select', options: RECORD_STATUSES.map((s) => ({ label: s, value: s })) },
      ]}
      columns={[
        { key: 'companyName', header: 'Company' },
        { key: 'siteName', header: 'Site' },
        { key: 'city', header: 'City' },
        { key: 'country', header: 'Country' },
        { key: 'licenseNo', header: 'License' },
        { key: 'status', header: 'Status' },
      ]}
    />
  );
}
