'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ShieldX } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  redirectTo?: string;
  requireAuth?: boolean;
  allowedRoles?: string[];
}

export function ProtectedRoute({
  children,
  redirectTo = '/auth/login',
  requireAuth = true,
  allowedRoles,
}: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !requireAuth) return;
    if (!user) {
      router.replace(redirectTo);
    }
  }, [user, loading, requireAuth, redirectTo, router]);

  if (loading) {
    return <LoadingSpinner label="Authenticating..." />;
  }

  if (requireAuth && !user) {
    return null;
  }

  if (allowedRoles && profile?.role && !allowedRoles.includes(profile.role)) {
    return (
      <Card className="max-w-lg mx-auto mt-12 border-red-200">
        <CardContent className="p-8 text-center space-y-4">
          <ShieldX className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-bold">Access Denied</h2>
          <p className="text-muted-foreground text-sm">Your role does not have access to this page.</p>
          <Button asChild variant="outline">
            <Link href="/dashboard">Return to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
