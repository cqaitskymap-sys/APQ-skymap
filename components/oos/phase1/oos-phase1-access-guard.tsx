'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewPhase1 } from '@/lib/oos-phase1-records';
import type { OosRecord } from '@/lib/oos-types';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function OosPhase1AccessGuard({ record, children }: { record?: OosRecord | null; children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewPhase1(profile?.role, record)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view this Phase-I investigation." />
    );
  }
  return <>{children}</>;
}
