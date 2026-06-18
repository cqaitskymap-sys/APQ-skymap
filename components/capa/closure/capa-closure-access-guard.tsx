'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewCapaClosure } from '@/lib/capa-closure-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function CapaClosureAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewCapaClosure(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view CAPA closure." />
    );
  }
  return <>{children}</>;
}
