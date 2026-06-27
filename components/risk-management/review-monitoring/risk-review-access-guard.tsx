'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewRiskReview } from '@/lib/risk-review-monitoring-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function RiskReviewAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewRiskReview(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view risk review & monitoring." />
    );
  }
  return <>{children}</>;
}
