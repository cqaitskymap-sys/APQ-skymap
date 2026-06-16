'use client';

import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canViewDocumentNumbering } from '@/lib/permissions';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function DocumentNumberingAccessGuard({ children }: { children: React.ReactNode }) {
  const { role } = useAdminPermissions();

  if (!canViewDocumentNumbering(role)) {
    return <ErrorCard accessDenied message="You do not have permission to access Document Numbering." />;
  }

  return <>{children}</>;
}
