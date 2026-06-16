'use client';

import { useAuth } from '@/contexts/auth-context';
import { canCreateOos } from '@/lib/oos-create-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function OosCreateAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canCreateOos(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to create OOS records." />
    );
  }
  return <>{children}</>;
}
