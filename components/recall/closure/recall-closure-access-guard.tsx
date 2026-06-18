'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewRecallClosure } from '@/lib/recall-types';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function RecallClosureAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewRecallClosure(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view recall closure." />
    );
  }
  return <>{children}</>;
}
