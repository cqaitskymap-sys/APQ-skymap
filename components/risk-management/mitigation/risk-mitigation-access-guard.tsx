'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewRiskMitigation } from '@/lib/risk-mitigation-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function RiskMitigationAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewRiskMitigation(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view risk mitigation plans." />
    );
  }
  return <>{children}</>;
}
