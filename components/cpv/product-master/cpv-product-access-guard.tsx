'use client';

import { useAuth } from '@/contexts/auth-context';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function CpvProductAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const role = profile?.role;
  if (!role) {
    return (
      <ErrorCard
        accessDenied
        title="Access Denied"
        message="You do not have permission to access CPV Product Master."
      />
    );
  }

  return <>{children}</>;
}
