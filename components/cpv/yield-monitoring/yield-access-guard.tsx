'use client';

import { useAuth } from '@/contexts/auth-context';
import { cpvPermissions } from '@/lib/cpv';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function YieldAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!profile?.role || !cpvPermissions.canViewYield(profile.role)) {
    return <ErrorCard accessDenied title="Access Denied" message="You do not have permission to access Yield Monitoring." />;
  }
  return <>{children}</>;
}
