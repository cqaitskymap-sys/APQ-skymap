'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewDeviationReports } from '@/lib/deviation-reports-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function DeviationReportsAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewDeviationReports(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view deviation reports and analytics." />
    );
  }
  return <>{children}</>;
}
