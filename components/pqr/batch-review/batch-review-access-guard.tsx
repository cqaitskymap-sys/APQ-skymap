'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewBatchReview } from '@/lib/pqr-batch-review-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function BatchReviewAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!profile?.role || !canViewBatchReview(profile.role)) {
    return (
      <ErrorCard
        accessDenied
        title="Access Denied"
        message="You do not have permission to access Batch Review."
      />
    );
  }
  return <>{children}</>;
}
