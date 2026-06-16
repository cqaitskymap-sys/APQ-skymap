'use client';

import { useAuth } from '@/contexts/auth-context';
import { canCreateCapaWizard } from '@/lib/capa-create-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function CapaCreateAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canCreateCapaWizard(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to create CAPA records." />
    );
  }
  return <>{children}</>;
}
