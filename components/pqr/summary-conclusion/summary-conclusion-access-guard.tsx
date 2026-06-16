'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewSummaryConclusion } from '@/lib/pqr-summary-conclusion-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function SummaryConclusionAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!profile?.role || !canViewSummaryConclusion(profile.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to access PQR Summary & Conclusion." />
    );
  }
  return <>{children}</>;
}
