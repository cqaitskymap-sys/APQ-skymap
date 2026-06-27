'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewRiskDashboard } from '@/lib/risk-dashboard-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function RiskDashboardAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewRiskDashboard(profile?.role)) {
    return (
      <ErrorCard
        accessDenied
        title="Access Denied"
        message="You do not have permission to view the Risk Assessment Dashboard."
      />
    );
  }
  return <>{children}</>;
}
