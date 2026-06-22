'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewRecallReportsModule } from '@/lib/recall-reports-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function RecallReportsAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewRecallReportsModule(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view recall reports and analytics." />
    );
  }
  return <>{children}</>;
}
