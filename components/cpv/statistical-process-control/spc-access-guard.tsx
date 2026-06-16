'use client';

import { useAuth } from '@/contexts/auth-context';
import { cpvPermissions } from '@/lib/cpv';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function SpcAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!profile?.role || !cpvPermissions.canViewSpc(profile.role)) {
    return (
      <ErrorCard
        accessDenied
        title="Access Denied"
        message="You do not have permission to access Statistical Process Control."
      />
    );
  }
  return <>{children}</>;
}
