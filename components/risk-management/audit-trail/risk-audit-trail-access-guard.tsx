'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewRiskAuditTrailModule } from '@/lib/risk-audit-trail-types';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function RiskAuditTrailAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewRiskAuditTrailModule(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view risk audit trail." />
    );
  }
  return <>{children}</>;
}
