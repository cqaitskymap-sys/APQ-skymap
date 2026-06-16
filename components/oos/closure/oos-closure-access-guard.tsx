'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewOosClosure } from '@/lib/oos-closure-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function OosClosureAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewOosClosure(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view OOS closure." />
    );
  }
  return <>{children}</>;
}
