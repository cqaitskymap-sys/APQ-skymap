'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewCcApproval } from '@/lib/cc-approval-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function CcApprovalAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewCcApproval(profile?.role)) {
    return (
      <ErrorCard
        accessDenied
        title="Access Denied"
        message="You do not have permission to view Change Control Approval Workflow."
      />
    );
  }
  return <>{children}</>;
}
