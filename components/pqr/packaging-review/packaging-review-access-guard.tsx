'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewPackagingReview } from '@/lib/pqr-packaging-review-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function PackagingReviewAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!profile?.role || !canViewPackagingReview(profile.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to access Packaging Review." />
    );
  }
  return <>{children}</>;
}
