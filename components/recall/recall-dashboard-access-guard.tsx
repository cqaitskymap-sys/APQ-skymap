'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewRecallDashboard } from '@/lib/recall-dashboard-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function RecallDashboardAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewRecallDashboard(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view the product recall dashboard." />
    );
  }
  return <>{children}</>;
}
