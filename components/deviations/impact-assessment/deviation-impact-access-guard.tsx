'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewImpactAssessment } from '@/lib/deviation-impact-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function DeviationImpactAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewImpactAssessment(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view deviation impact assessments." />
    );
  }
  return <>{children}</>;
}
