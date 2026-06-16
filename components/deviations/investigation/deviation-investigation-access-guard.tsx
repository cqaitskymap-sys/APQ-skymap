'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewInvestigation } from '@/lib/deviation-investigation-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function DeviationInvestigationAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewInvestigation(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view deviation investigations." />
    );
  }
  return <>{children}</>;
}
