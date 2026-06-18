'use client';

import { ReactNode } from 'react';
import { ShieldX } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { usePermissions } from '@/hooks/usePermissions';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import type { AdminModule, PermissionAction, AppModule } from '@/lib/permissions';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface AdminPermissionGuardProps {
  module: AdminModule;
  action: PermissionAction;
  children: ReactNode;
  fallback?: ReactNode;
}

/** Guards admin-panel pages using the admin permission matrix */
export function AdminPermissionGuard({ module, action, children, fallback }: AdminPermissionGuardProps) {
  const { hasPermission, loading } = useAdminPermissions();

  if (loading) return <LoadingSpinner label="Checking permissions..." />;

  if (!hasPermission(module, action)) {
    if (fallback) return <>{fallback}</>;
    return <AccessDenied message={`You do not have permission to ${action} ${module} modules.`} />;
  }

  return <>{children}</>;
}

interface ModuleGuardProps {
  module: AppModule;
  children: ReactNode;
  fallback?: ReactNode;
  action?: 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export';
}

/** Guards application modules using user-specific permissions */
export function ModuleGuard({ module, children, fallback, action = 'view' }: ModuleGuardProps) {
  const { canPerformAction, loading, logDenied } = usePermissions();
  const pathname = usePathname();

  if (loading) return <LoadingSpinner label="Checking permissions..." />;

  if (!canPerformAction(module, action)) {
    if (fallback) return <>{fallback}</>;
    logDenied(module, pathname);
    return <AccessDenied message="Your role does not have access to this module." />;
  }

  return <>{children}</>;
}

/** @deprecated Use ModuleGuard or AdminPermissionGuard */
export const PermissionGuard = AdminPermissionGuard;
/** @deprecated Use ModuleGuard */
export const RoleGuard = ModuleGuard;

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
