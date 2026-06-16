'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewCapaDashboard } from '@/lib/capa-dashboard-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function CapaDashboardAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!profile?.role || !canViewCapaDashboard(profile.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view the CAPA dashboard." />
    );
  }
  return <>{children}</>;
}
