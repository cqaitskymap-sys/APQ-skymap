'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewCcValidation } from '@/lib/cc-validation-records';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function CcValidationAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewCcValidation(profile?.role)) {
    return (
      <ErrorCard
        accessDenied
        title="Access Denied"
        message="You do not have permission to view Validation Assessments."
      />
    );
  }
  return <>{children}</>;
}
