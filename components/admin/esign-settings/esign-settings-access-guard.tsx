'use client';

import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canViewEsignSettings } from '@/lib/permissions';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function EsignSettingsAccessGuard({ children }: { children: React.ReactNode }) {
  const { role } = useAdminPermissions();

  if (!canViewEsignSettings(role)) {
    return <ErrorCard accessDenied message="You do not have permission to access E-Signature Settings." />;
  }

  return <>{children}</>;
}
