'use client';

import { useAuth } from '@/contexts/auth-context';
import { cpvPermissions } from '@/lib/cpv';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function EnvironmentalAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!profile?.role || !cpvPermissions.canViewEnvironmental(profile.role)) {
    return <ErrorCard accessDenied title="Access Denied" message="You do not have permission to access Environmental Monitoring." />;
  }
  return <>{children}</>;
}
