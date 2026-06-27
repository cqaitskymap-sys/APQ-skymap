'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewRecallAuditTrail } from '@/lib/recall-audit-trail-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function RecallAuditTrailAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewRecallAuditTrail(profile?.role)) {
    return (
      <ErrorCard
        accessDenied
        title="Access Denied"
        message="You do not have permission to view the Recall Audit Trail."
      />
    );
  }
  return <>{children}</>;
}
