'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewRiskReportsModule } from '@/lib/risk-reports-types';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function RiskReportsAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewRiskReportsModule(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view risk reports and analytics." />
    );
  }
  return <>{children}</>;
}
