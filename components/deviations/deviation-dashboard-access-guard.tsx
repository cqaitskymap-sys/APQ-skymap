'use client';

import { useAuth } from '@/contexts/auth-context';
import { canAccessDeviationDashboard } from '@/services/deviationDashboardService';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ShieldX } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export function DeviationDashboardAccessGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();

  if (loading) return <LoadingSkeleton rows={3} />;

  if (!canAccessDeviationDashboard(profile?.role)) {
    return (
      <Card className="mx-auto mt-8 max-w-lg border-red-200">
        <CardContent className="space-y-4 p-8 text-center">
          <ShieldX className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="text-xl font-bold">Access Denied</h2>
          <p className="text-sm text-muted-foreground">
            Your role does not have permission to view the Deviation Dashboard.
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
