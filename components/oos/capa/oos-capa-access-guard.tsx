'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewOosCapa } from '@/lib/oos-capa-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function OosCapaAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewOosCapa(profile?.role)) {
    return <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view OOS CAPA management." />;
  }
  return <>{children}</>;
}
