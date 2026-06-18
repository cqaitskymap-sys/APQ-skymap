'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewRecallTrend } from '@/lib/recall-types';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function RecallTrendAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewRecallTrend(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view recall trend analysis." />
    );
  }
  return <>{children}</>;
}
