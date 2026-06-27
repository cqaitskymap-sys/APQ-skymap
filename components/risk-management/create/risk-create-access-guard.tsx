'use client';

import { useAuth } from '@/contexts/auth-context';
import { canCreateRiskAssessmentWizard } from '@/lib/risk-create-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function RiskCreateAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canCreateRiskAssessmentWizard(profile?.role)) {
    return (
      <ErrorCard
        accessDenied
        title="Access Denied"
        message="You do not have permission to create risk assessments."
      />
    );
  }
  return <>{children}</>;
}
