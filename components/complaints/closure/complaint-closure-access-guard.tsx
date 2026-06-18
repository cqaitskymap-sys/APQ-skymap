'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewComplaintClosure } from '@/lib/complaint-closure-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function ComplaintClosureAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewComplaintClosure(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view complaint closure." />
    );
  }
  return <>{children}</>;
}
