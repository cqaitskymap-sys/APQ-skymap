'use client';

import { MasterCrudPage } from '@/components/admin/master-crud-page';
import { ADMIN_COLLECTIONS, LOGIN_STATUSES } from '@/lib/admin/constants';
import { loginActivitySchema } from '@/lib/admin/schemas';
import { StatusBadge } from '@/components/admin/admin-data-table';

export default function LoginActivityPage() {
  return (
    <MasterCrudPage
      title="Login Activity"
      description="Monitor user login attempts, sessions, and security events"
      collection={ADMIN_COLLECTIONS.loginActivity}
      module="Admin"
      schema={loginActivitySchema}
      defaultValues={{
        userId: '', userName: '', email: '', loginStatus: 'Success',
        ipAddress: '', deviceInfo: '', loginTime: new Date().toISOString(),
        logoutTime: null, failureReason: '', status: 'Active',
      }}
      fields={[
        { name: 'userName', label: 'User Name', required: true },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'loginStatus', label: 'Login Status', type: 'select', options: LOGIN_STATUSES.map((s) => ({ label: s, value: s })) },
        { name: 'ipAddress', label: 'IP Address' },
        { name: 'deviceInfo', label: 'Device Info', colSpan: 2 },
        { name: 'loginTime', label: 'Login Time', type: 'date' },
        { name: 'failureReason', label: 'Failure Reason' },
        { name: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }] },
      ]}
      columns={[
        { key: 'userName', header: 'User' },
        { key: 'email', header: 'Email' },
        { key: 'loginStatus', header: 'Status', render: (r) => <StatusBadge status={r.loginStatus} /> },
        { key: 'ipAddress', header: 'IP Address' },
        { key: 'loginTime', header: 'Login Time', render: (r) => r.loginTime ? new Date(r.loginTime).toLocaleString() : '-' },
        { key: 'deviceInfo', header: 'Device' },
      ]}
      statusOptions={[...LOGIN_STATUSES, 'Active', 'Inactive']}
    />
  );
}
