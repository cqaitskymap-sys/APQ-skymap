'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewOosImpactAssessment } from '@/lib/oos-impact-records';
import type { OosRecord } from '@/lib/oos-types';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function OosImpactAccessGuard({ record, children }: { record?: OosRecord | null; children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewOosImpactAssessment(profile?.role, record)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view this OOS impact assessment." />
    );
  }
  return <>{children}</>;
}
