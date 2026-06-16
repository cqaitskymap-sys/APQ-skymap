'use client';

import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canViewAuditTrail } from '@/lib/permissions';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function AuditTrailAccessGuard({ children }: { children: React.ReactNode }) {
  const { role } = useAdminPermissions();

  if (!canViewAuditTrail(role)) {
    return <ErrorCard accessDenied message="You do not have permission to access Audit Trail." />;
  }

  return <>{children}</>;
}
