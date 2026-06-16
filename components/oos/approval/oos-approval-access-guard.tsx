'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewOosApproval } from '@/lib/oos-approval-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function OosApprovalAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewOosApproval(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view OOS approvals." />
    );
  }
  return <>{children}</>;
}
