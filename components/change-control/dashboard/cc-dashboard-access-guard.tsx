'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewCcDashboard } from '@/lib/cc-dashboard-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function CcDashboardAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewCcDashboard(profile?.role)) {
    return (
      <ErrorCard
        accessDenied
        title="Access Denied"
        message="You do not have permission to view the Change Control Dashboard."
      />
    );
  }
  return <>{children}</>;
}
