'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewComplaintDashboard } from '@/lib/complaint-dashboard-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function ComplaintDashboardAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!profile?.role || !canViewComplaintDashboard(profile.role)) {
    return (
      <ErrorCard accessDenied title="Access Denied" message="You do not have permission to view the Complaint dashboard." />
    );
  }
  return <>{children}</>;
}
