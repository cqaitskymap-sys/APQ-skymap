'use client';

import { ReactNode } from 'react';
import { ShieldX } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import type { AdminModule, PermissionAction } from '@/lib/permissions';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface PermissionGuardProps {
  module: AdminModule;
  action: PermissionAction;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGuard({ module, action, children, fallback }: PermissionGuardProps) {
  const { hasPermission, loading } = useAdminPermissions();

  if (loading) return <LoadingSpinner label="Checking permissions..." />;

  if (!hasPermission(module, action)) {
    if (fallback) return <>{fallback}</>;
    return (
      <Card className="max-w-lg mx-auto mt-12 border-red-200">
        <CardContent className="p-8 text-center space-y-4">
          <ShieldX className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-bold">Access Denied</h2>
          <p className="text-muted-foreground text-sm">
            You do not have permission to {action} {module} modules.
          </p>
          <Button asChild variant="outline">
            <Link href="/dashboard">Return to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
