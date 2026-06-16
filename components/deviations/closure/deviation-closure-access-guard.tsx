'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewClosure } from '@/lib/deviation-closure-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function DeviationClosureAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewClosure(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view deviation closure." />
    );
  }
  return <>{children}</>;
}
