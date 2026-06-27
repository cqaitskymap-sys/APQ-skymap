'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewRiskApproval } from '@/lib/risk-approval-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function RiskApprovalAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewRiskApproval(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view risk approval workflow." />
    );
  }
  return <>{children}</>;
}
