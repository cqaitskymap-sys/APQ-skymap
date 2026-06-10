'use client';

import { MasterCrudPage } from '@/components/admin/master-crud-page';
import { ADMIN_COLLECTIONS, RECORD_STATUSES, NOTIFICATION_EVENTS, ADMIN_ROLES } from '@/lib/admin/constants';
import { notificationSettingSchema } from '@/lib/admin/schemas';

const roleOptions = ADMIN_ROLES.map((r) => ({ label: r.name, value: r.id }));

export default function NotificationSettingsPage() {
  return (
    <MasterCrudPage
      title="Notification Settings"
      description="Configure email, in-app, and SMS alerts for QMS events"
      collection={ADMIN_COLLECTIONS.notificationSettings}
      module="Admin"
      schema={notificationSettingSchema}
      defaultValues={{
        eventName: 'PQR Approval Pending', recipientRole: 'qa_manager',
        beforeDueDays: 3, escalationDays: 7, emailEnabled: true,
        inAppEnabled: true, smsEnabled: false, template: '', status: 'Active',
      }}
      fields={[
        { name: 'eventName', label: 'Event Name', type: 'select', required: true, options: NOTIFICATION_EVENTS.map((e) => ({ label: e, value: e })) },
        { name: 'recipientRole', label: 'Recipient Role', type: 'select', options: roleOptions },
        { name: 'beforeDueDays', label: 'Before Due Days', type: 'number' },
        { name: 'escalationDays', label: 'Escalation Days', type: 'number' },
        { name: 'emailEnabled', label: 'Email Enabled', type: 'switch' },
        { name: 'inAppEnabled', label: 'In-App Enabled', type: 'switch' },
        { name: 'smsEnabled', label: 'SMS Enabled (Optional)', type: 'switch' },
        { name: 'template', label: 'Notification Template', type: 'textarea', colSpan: 2 },
        { name: 'status', label: 'Status', type: 'select', options: RECORD_STATUSES.map((s) => ({ label: s, value: s })) },
      ]}
      columns={[
        { key: 'eventName', header: 'Event' },
        { key: 'recipientRole', header: 'Recipient', render: (r) => r.recipientRole?.replace(/_/g, ' ') },
        { key: 'beforeDueDays', header: 'Before Due' },
        { key: 'escalationDays', header: 'Escalation' },
        { key: 'status', header: 'Status' },
      ]}
    />
  );
}
