'use client';

import { useAuth } from '@/contexts/auth-context';
import { canCreateRecallWizard } from '@/lib/recall-create-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function RecallCreateAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canCreateRecallWizard(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to create product recall records." />
    );
  }
  return <>{children}</>;
}
