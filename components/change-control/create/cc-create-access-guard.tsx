'use client';

import { useAuth } from '@/contexts/auth-context';
import { canCreateCcChange } from '@/lib/cc-create-records';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';

export function CcCreateAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!canCreateCcChange(profile?.role)) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>You do not have permission to create change controls.</AlertDescription>
      </Alert>
    );
  }
  return <>{children}</>;
}
