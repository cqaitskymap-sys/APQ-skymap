'use client';

import { useAuth } from '@/contexts/auth-context';
import { canCreateAnnualPqr } from '@/lib/pqr-create-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function PqrCreateAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!profile?.role || !canCreateAnnualPqr(profile.role)) {
    return (
      <ErrorCard
        accessDenied
        title="Access Denied"
        message="You do not have permission to create Annual PQR records."
      />
    );
  }
  return <>{children}</>;
}
