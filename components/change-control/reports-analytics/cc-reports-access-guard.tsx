'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewCcReports } from '@/lib/cc-reports-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function CcReportsAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewCcReports(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view Change Control reports." />
    );
  }
  return <>{children}</>;
}
