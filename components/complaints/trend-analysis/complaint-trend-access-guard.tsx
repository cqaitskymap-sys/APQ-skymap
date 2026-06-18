'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewComplaintTrend } from '@/lib/complaint-trend-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function ComplaintTrendAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewComplaintTrend(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view complaint trend analysis." />
    );
  }
  return <>{children}</>;
}
