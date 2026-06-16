'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewEquipmentReview } from '@/lib/pqr-equipment-review-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function EquipmentReviewAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!profile?.role || !canViewEquipmentReview(profile.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to access Equipment Review." />
    );
  }
  return <>{children}</>;
}
