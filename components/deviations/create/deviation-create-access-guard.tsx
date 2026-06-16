'use client';

import { useAuth } from '@/contexts/auth-context';
import { canCreateDeviation } from '@/lib/deviation-create-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function DeviationCreateAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canCreateDeviation(profile?.role)) {
    return (
      <ErrorCard
        accessDenied
        title="Access Denied"
        message="You do not have permission to create deviation records."
      />
    );
  }
  return <>{children}</>;
}
