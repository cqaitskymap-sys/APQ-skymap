'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewStabilityReview } from '@/lib/pqr-stability-review-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function StabilityReviewAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!profile?.role || !canViewStabilityReview(profile.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to access Stability Review." />
    );
  }
  return <>{children}</>;
}
