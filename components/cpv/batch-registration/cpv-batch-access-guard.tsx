'use client';

import { useAuth } from '@/contexts/auth-context';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function CpvBatchAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!profile?.role) {
    return (
      <ErrorCard
        accessDenied
        title="Access Denied"
        message="You do not have permission to access CPV Batch Registration."
      />
    );
  }
  return <>{children}</>;
}
