'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { clearAuthSessionCookies } from '@/lib/auth-session-cookies';
import { Skeleton } from '@/components/ui/skeleton';

interface AdminAuthGuardProps {
  children: React.ReactNode;
  requireSuperAdmin?: boolean;
  requireManageUsers?: boolean;
  requireManageMaster?: boolean;
}

export function AdminAuthGuard({
  children,
  requireSuperAdmin,
  requireManageUsers,
  requireManageMaster,
}: AdminAuthGuardProps) {
  const { user, loading: authLoading } = useAuth();
  const perms = useAdminPermissions();
  const router = useRouter();

  useEffect(() => {
    if (authLoading || perms.loading) return;
    if (!user) {
      clearAuthSessionCookies();
      router.replace('/auth/login?redirect=/admin');
      return;
    }
    if (!perms.canAccessAdmin) {
      router.replace('/dashboard');
      return;
    }
    if (requireSuperAdmin && !perms.canManageRoles) {
      router.replace('/dashboard/admin');
      return;
    }
    if (requireManageUsers && !perms.canManageUsers) {
      router.replace('/dashboard/admin');
      return;
    }
    if (requireManageMaster && !perms.canManageMasterData && perms.isReadOnly) {
      router.replace('/dashboard/admin');
    }
  }, [
    user,
    authLoading,
    perms.loading,
    perms.canAccessAdmin,
    perms.canManageRoles,
    perms.canManageUsers,
    perms.canManageMasterData,
    perms.isReadOnly,
    router,
    requireSuperAdmin,
    requireManageUsers,
    requireManageMaster,
  ]);

  if (authLoading || perms.loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (!perms.canAccessAdmin) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return <>{children}</>;
}
