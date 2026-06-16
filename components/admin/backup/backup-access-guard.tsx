'use client';

import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canViewBackup } from '@/lib/permissions';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function BackupAccessGuard({ children }: { children: React.ReactNode }) {
  const { role } = useAdminPermissions();
  if (!canViewBackup(role)) {
    return <ErrorCard accessDenied message="You do not have permission to access Backup & Restore." />;
  }
  return <>{children}</>;
}
