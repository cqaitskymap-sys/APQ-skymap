'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewOosAuditTrail } from '@/lib/oos-audit-trail-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function OosAuditTrailAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewOosAuditTrail(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view OOS audit trail." />
    );
  }
  return <>{children}</>;
}
