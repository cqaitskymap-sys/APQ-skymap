'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewRiskFmea } from '@/lib/risk-fmea-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function RiskFmeaAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewRiskFmea(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view FMEA risk assessments." />
    );
  }
  return <>{children}</>;
}
