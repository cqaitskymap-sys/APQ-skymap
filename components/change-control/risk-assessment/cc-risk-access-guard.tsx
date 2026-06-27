'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewCcRisk } from '@/lib/cc-risk-records';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';

export function CcRiskAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewCcRisk(profile?.role)) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>You do not have permission to view Change Risk Assessments.</AlertDescription>
      </Alert>
    );
  }
  return <>{children}</>;
}
