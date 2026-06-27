'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewCcAuditTrail } from '@/lib/cc-audit-trail-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function CcAuditTrailAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewCcAuditTrail(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view Change Control audit trail." />
    );
  }
  return <>{children}</>;
}
