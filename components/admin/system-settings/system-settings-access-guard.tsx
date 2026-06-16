'use client';

import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canViewSystemSettings } from '@/lib/permissions';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function SystemSettingsAccessGuard({ children }: { children: React.ReactNode }) {
  const { role } = useAdminPermissions();
  if (!canViewSystemSettings(role)) {
    return <ErrorCard accessDenied message="You do not have permission to access System Settings." />;
  }
  return <>{children}</>;
}
