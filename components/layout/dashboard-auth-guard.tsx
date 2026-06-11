'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Skeleton } from '@/components/ui/skeleton';

export function DashboardAuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      // The middleware only sees the cookie, while demo auth is stored in
      // localStorage. Clear a stale cookie before navigating to avoid a
      // /dashboard <-> /auth/login redirect loop.
      document.cookie = 'firebase-auth-session=; path=/; max-age=0; SameSite=Lax';
      document.cookie = '__session=; path=/; max-age=0; SameSite=Lax';
      router.replace(`/auth/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [user, loading, router, pathname]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-4 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (!user) return null;
  return <>{children}</>;
}
