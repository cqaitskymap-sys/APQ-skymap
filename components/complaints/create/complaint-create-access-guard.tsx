'use client';

import { useAuth } from '@/contexts/auth-context';
import { canCreateComplaintWizard } from '@/lib/complaint-create-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function ComplaintCreateAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canCreateComplaintWizard(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to create complaint records." />
    );
  }
  return <>{children}</>;
}
