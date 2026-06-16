'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewMaterialReview } from '@/lib/pqr-material-review-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function MaterialReviewAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!profile?.role || !canViewMaterialReview(profile.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to access Material Review." />
    );
  }
  return <>{children}</>;
}
