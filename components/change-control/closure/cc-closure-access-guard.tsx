'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewCcClosure } from '@/lib/cc-closure-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function CcClosureAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewCcClosure(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view Change Control closure." />
    );
  }
  return <>{children}</>;
}
