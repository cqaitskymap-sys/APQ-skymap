'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewComplaintInvestigation } from '@/lib/complaint-investigation-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function ComplaintInvestigationAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewComplaintInvestigation(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view complaint investigations." />
    );
  }
  return <>{children}</>;
}
