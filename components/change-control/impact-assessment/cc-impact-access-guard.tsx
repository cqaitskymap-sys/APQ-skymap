'use client';

import { useAuth } from '@/contexts/auth-context';
import { canViewCcImpact } from '@/lib/cc-impact-records';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';

export function CcImpactAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canViewCcImpact(profile?.role)) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>You do not have permission to view Change Impact Assessments.</AlertDescription>
      </Alert>
    );
  }
  return <>{children}</>;
}
