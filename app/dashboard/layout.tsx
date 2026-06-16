'use client';

import { usePathname } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { ProtectedRoute } from '@/components/auth/protected-route';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/dashboard/admin');

  return (
    <ProtectedRoute>
      {isAdminRoute ? children : <AppShell>{children}</AppShell>}
    </ProtectedRoute>
  );
}
