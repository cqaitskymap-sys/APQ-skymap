'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewCapaAuditTrail } from '@/lib/capa-audit-trail-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function CapaAuditTrailAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewCapaAuditTrail(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view CAPA audit trail." />
    );
  }
  return <>{children}</>;
}
