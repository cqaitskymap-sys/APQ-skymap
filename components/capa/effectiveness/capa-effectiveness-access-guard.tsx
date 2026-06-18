'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewCapaEffectiveness } from '@/lib/capa-effectiveness-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function CapaEffectivenessAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewCapaEffectiveness(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view CAPA effectiveness reviews." />
    );
  }
  return <>{children}</>;
}
