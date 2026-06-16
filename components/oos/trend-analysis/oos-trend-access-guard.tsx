'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewOosTrend } from '@/lib/oos-trend-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function OosTrendAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewOosTrend(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view OOS trend analysis." />
    );
  }
  return <>{children}</>;
}
