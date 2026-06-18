'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewCapaReports } from '@/lib/capa-reports-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function CapaReportsAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewCapaReports(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view CAPA reports and analytics." />
    );
  }
  return <>{children}</>;
}
