'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewCapaPreventiveAction } from '@/lib/capa-preventive-action-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function CapaPreventiveActionAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewCapaPreventiveAction(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view CAPA preventive actions." />
    );
  }
  return <>{children}</>;
}
