'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewCapaApproval } from '@/lib/capa-approval-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function CapaApprovalAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewCapaApproval(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view CAPA approval workflow." />
    );
  }
  return <>{children}</>;
}
