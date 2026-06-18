'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewComplaintCapaLink } from '@/lib/complaint-capa-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function ComplaintCapaAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewComplaintCapaLink(profile?.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view complaint CAPA links." />
    );
  }
  return <>{children}</>;
}
