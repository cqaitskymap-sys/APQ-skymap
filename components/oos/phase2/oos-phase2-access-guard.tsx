'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewPhase2 } from '@/lib/oos-phase2-records';
import type { OosRecord } from '@/lib/oos-types';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function OosPhase2AccessGuard({ record, children }: { record?: OosRecord | null; children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewPhase2(profile?.role, record)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view this Phase-II investigation." />
    );
  }
  return <>{children}</>;
}
