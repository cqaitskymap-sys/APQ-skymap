'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewCcImplementation } from '@/lib/cc-implementation-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function CcImplementationAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewCcImplementation(profile?.role)) {
    return (
      <ErrorCard
        accessDenied
        title="Access Denied"
        message="You do not have permission to view Implementation Plans."
      />
    );
  }
  return <>{children}</>;
}
