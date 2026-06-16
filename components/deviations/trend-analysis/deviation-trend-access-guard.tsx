'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewTrend } from '@/lib/deviation-trend-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function DeviationTrendAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewTrend(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view deviation trend analysis." />
    );
  }
  return <>{children}</>;
}
