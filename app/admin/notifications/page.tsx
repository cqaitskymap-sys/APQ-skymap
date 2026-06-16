'use client';

import { NotificationSettingsAccessGuard } from '@/components/admin/notifications/notification-settings-access-guard';
import { NotificationSettingsListPage } from '@/components/admin/notifications/notification-settings-list-page';

export default function AdminNotificationsPage() {
  return (
    <NotificationSettingsAccessGuard>
      <NotificationSettingsListPage />
    </NotificationSettingsAccessGuard>
  );
}
