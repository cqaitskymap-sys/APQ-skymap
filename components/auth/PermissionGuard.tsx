'use client';

import { ReactNode } from 'react';
import { ShieldX } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import type { AdminModule, PermissionAction, AppModule } from '@/lib/permissions';
import { canAccessModule, isReadOnlyRole } from '@/lib/permissions';
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
    return <AccessDenied message={`You do not have permission to ${action} ${module} modules.`} />;
  }

  return <>{children}</>;
}

interface RoleGuardProps {
  module: AppModule;
  children: ReactNode;
  fallback?: ReactNode;
  requireEdit?: boolean;
}

export function RoleGuard({ module, children, fallback, requireEdit = false }: RoleGuardProps) {
  const { profile, loading } = useAuth();

  if (loading) return <LoadingSpinner label="Checking permissions..." />;

  const allowed = requireEdit
    ? canAccessModule(profile?.role, module) && !isReadOnlyRole(profile?.role)
    : canAccessModule(profile?.role, module);

  if (!allowed) {
    if (fallback) return <>{fallback}</>;
    return <AccessDenied message="Your role does not have access to this module." />;
  }

  return <>{children}</>;
}

function AccessDenied({ message }: { message: string }) {
  return (
    <Card className="max-w-lg mx-auto mt-12 border-red-200">
      <CardContent className="p-8 text-center space-y-4">
        <ShieldX className="h-12 w-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground text-sm">{message}</p>
        <Button asChild variant="outline">
          <Link href="/dashboard">Return to Dashboard</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
