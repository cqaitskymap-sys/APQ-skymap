'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewComplaintImpactAssessment } from '@/lib/complaint-impact-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function ComplaintImpactAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewComplaintImpactAssessment(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view complaint impact assessments." />
    );
  }
  return <>{children}</>;
}
