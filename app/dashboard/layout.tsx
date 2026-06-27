'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

// AppShell pulls in a large lucide-react icon tree; SSR breaks the dev RSC client manifest on Windows.
const AppShell = dynamic(() => import('@/components/layout/AppShell'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingSpinner label="Loading workspace..." />
    </div>
  ),
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
