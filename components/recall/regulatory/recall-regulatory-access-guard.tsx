'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewRecallRegulatory } from '@/lib/recall-types';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function RecallRegulatoryAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewRecallRegulatory(profile?.role)) {
    return (
      <ErrorCard
        accessDenied
        title="Access Denied"
        message="You do not have permission to view recall regulatory notification and approval."
      />
    );
  }
  return <>{children}</>;
}
