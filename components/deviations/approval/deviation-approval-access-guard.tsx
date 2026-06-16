'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewDeviationApproval } from '@/lib/deviation-approval-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function DeviationApprovalAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewDeviationApproval(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view deviation approvals." />
    );
  }
  return <>{children}</>;
}
