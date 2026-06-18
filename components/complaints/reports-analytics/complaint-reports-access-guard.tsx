'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewComplaintReports } from '@/lib/complaint-reports-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function ComplaintReportsAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewComplaintReports(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view complaint reports and analytics." />
    );
  }
  return <>{children}</>;
}
