'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewCpvConfiguration } from '@/lib/cpv-configuration-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function ConfigurationAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!profile?.role || !canViewCpvConfiguration(profile.role)) {
    return (
      <ErrorCard
        accessDenied
        title="Access Denied"
        message="You do not have permission to access CPV Configuration."
      />
    );
  }
  return <>{children}</>;
}
