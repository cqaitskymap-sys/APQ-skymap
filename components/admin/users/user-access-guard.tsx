'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canViewUsers } from '@/lib/permissions';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';

export function UserAccessGuard({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: permsLoading } = useAdminPermissions();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth/login?redirect=/admin/users');
    }
  }, [authLoading, user, router]);

  if (authLoading || permsLoading) {
    return <LoadingSkeleton rows={2} />;
  }

  if (!user) return null;

  if (!canViewUsers(role)) {
    return (
      <ErrorCard
        accessDenied
        title="Access Denied"
        message="You do not have permission to access User Management."
      />
    );
  }

  return <>{children}</>;
}
