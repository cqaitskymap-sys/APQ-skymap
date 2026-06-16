'use client';

import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canViewNotificationSettings } from '@/lib/permissions';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function NotificationSettingsAccessGuard({ children }: { children: React.ReactNode }) {
  const { role } = useAdminPermissions();
  if (!canViewNotificationSettings(role)) {
    return <ErrorCard accessDenied message="You do not have permission to access Notification Settings." />;
  }
  return <>{children}</>;
}
