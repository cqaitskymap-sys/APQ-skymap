'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewAiAnalytics } from '@/lib/cpv-ai-analytics-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function AiAnalyticsAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!profile?.role || !canViewAiAnalytics(profile.role)) {
    return (
      <ErrorCard
        accessDenied
        title="Access Denied"
        message="You do not have permission to access CPV AI Analytics."
      />
    );
  }
  return <>{children}</>;
}
