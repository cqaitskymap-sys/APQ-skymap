'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewComplaintAuditTrail } from '@/lib/complaint-audit-trail-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function ComplaintAuditTrailAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewComplaintAuditTrail(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view complaint audit trail." />
    );
  }
  return <>{children}</>;
}
