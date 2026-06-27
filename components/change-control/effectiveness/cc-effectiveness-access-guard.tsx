'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewCcEffectiveness } from '@/lib/cc-effectiveness-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function CcEffectivenessAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewCcEffectiveness(profile?.role)) {
    return (
      <ErrorCard
        accessDenied
        title="Access Denied"
        message="You do not have permission to view Change Effectiveness Reviews."
      />
    );
  }
  return <>{children}</>;
}
