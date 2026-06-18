'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewCapaTrend } from '@/lib/capa-trend-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function CapaTrendAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewCapaTrend(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view CAPA trend analysis." />
    );
  }
  return <>{children}</>;
}
