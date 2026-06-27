'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewRiskClosure } from '@/lib/risk-closure-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function RiskClosureAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewRiskClosure(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view risk closure." />
    );
  }
  return <>{children}</>;
}
