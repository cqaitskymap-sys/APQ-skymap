'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardSkeleton } from '@/components/loading';

const AppShell = dynamic(() => import('@/components/layout/AppShell'), {
  ssr: false,
  loading: () => <DashboardSkeleton />,
});

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/dashboard/admin');

  return (
    <ProtectedRoute>
      {isAdminRoute ? children : <AppShell>{children}</AppShell>}
    </ProtectedRoute>
  );
}
