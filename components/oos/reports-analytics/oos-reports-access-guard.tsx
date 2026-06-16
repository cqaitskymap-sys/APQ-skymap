'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewOosReports } from '@/lib/oos-reports-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function OosReportsAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewOosReports(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view OOS reports and analytics." />
    );
  }
  return <>{children}</>;
}
