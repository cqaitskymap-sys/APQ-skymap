'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewPqrDashboard } from '@/lib/pqr-dashboard-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function PqrDashboardAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!profile?.role || !canViewPqrDashboard(profile.role)) {
    return (
      <ErrorCard
        accessDenied
        title="Access Denied"
        message="You do not have permission to access the PQR Dashboard."
      />
    );
  }
  return <>{children}</>;
}
