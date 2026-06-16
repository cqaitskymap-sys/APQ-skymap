'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewDeviationAuditTrail } from '@/lib/deviation-audit-trail-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function DeviationAuditTrailAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewDeviationAuditTrail(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view deviation audit trail." />
    );
  }
  return <>{children}</>;
}
