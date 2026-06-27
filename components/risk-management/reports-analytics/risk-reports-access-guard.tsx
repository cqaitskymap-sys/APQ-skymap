'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewRiskReports } from '@/lib/risk-reports-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function RiskReportsAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewRiskReports(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view risk reports and analytics." />
    );
  }
  return <>{children}</>;
}
