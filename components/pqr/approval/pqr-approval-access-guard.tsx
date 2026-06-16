'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewPqrApproval } from '@/lib/pqr-approval-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function PqrApprovalAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!profile?.role || !canViewPqrApproval(profile.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to access PQR Approval." />
    );
  }
  return <>{children}</>;
}
