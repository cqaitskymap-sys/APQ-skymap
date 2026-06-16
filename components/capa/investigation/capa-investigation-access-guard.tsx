'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewCapaInvestigation } from '@/lib/capa-investigation-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function CapaInvestigationAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewCapaInvestigation(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view CAPA investigations." />
    );
  }
  return <>{children}</>;
}
