'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewOosDashboard } from '@/lib/oos-dashboard-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function OosDashboardAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!profile?.role || !canViewOosDashboard(profile.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view the OOS dashboard." />
    );
  }
  return <>{children}</>;
}
