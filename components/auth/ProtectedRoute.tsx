'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { usePermissions } from '@/hooks/usePermissions';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ShieldX } from 'lucide-react';
import { resolveModuleFromPath } from '@/lib/nav-permissions';
import type { AppModule } from '@/lib/permissions';

interface ProtectedRouteProps {
  children: ReactNode;
  redirectTo?: string;
  requireAuth?: boolean;
  module?: AppModule;
  allowedRoles?: string[];
}

export function ProtectedRoute({
  children,
  redirectTo = '/auth/login',
  requireAuth = true,
  module,
  allowedRoles,
}: ProtectedRouteProps) {
  const { user, profile, loading: authLoading } = useAuth();
  const { canAccessModule, loading: permLoading, logDenied } = usePermissions();
  const router = useRouter();
  const pathname = usePathname();

  const resolvedModule = module || resolveModuleFromPath(pathname);

  useEffect(() => {
    if (authLoading || !requireAuth) return;
    if (!user) {
      router.replace(redirectTo);
    }
  }, [user, authLoading, requireAuth, redirectTo, router]);

  const loading = authLoading || permLoading;

  if (loading) {
    return <LoadingSpinner label="Authenticating..." />;
  }

  if (requireAuth && !user) {
    return null;
  }

  if (allowedRoles && profile?.role && !allowedRoles.includes(profile.role)) {
    return <AccessDenied message="Your role does not have access to this page." />;
  }

  if (resolvedModule && !canAccessModule(resolvedModule)) {
    logDenied(resolvedModule, pathname);
    return <AccessDenied message="You do not have permission to access this module." />;
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
