'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewCapaCorrectiveAction } from '@/lib/capa-corrective-action-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function CapaCorrectiveActionAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewCapaCorrectiveAction(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view CAPA corrective actions." />
    );
  }
  return <>{children}</>;
}
