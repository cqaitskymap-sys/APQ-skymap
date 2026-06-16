'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewCapaLink } from '@/lib/deviation-capa-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function DeviationCapaAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewCapaLink(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view deviation CAPA links." />
    );
  }
  return <>{children}</>;
}
