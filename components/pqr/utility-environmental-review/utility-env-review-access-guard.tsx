'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewUtilityEnvReview } from '@/lib/pqr-utility-environmental-review-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function UtilityEnvReviewAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!profile?.role || !canViewUtilityEnvReview(profile.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to access Utility & Environmental Review." />
    );
  }
  return <>{children}</>;
}
