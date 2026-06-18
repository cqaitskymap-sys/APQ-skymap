'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewRecallRecovery } from '@/lib/recall-types';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function RecallRecoveryAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewRecallRecovery(profile?.role)) {
    return (
      <ErrorCard
        accessDenied
        title="Access Denied"
        message="You do not have permission to view recall recovery and distribution tracking."
      />
    );
  }
  return <>{children}</>;
}
