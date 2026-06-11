'use client';

import { AppShell } from '@/components/layout/AppShell';
import { ProtectedRoute } from '@/components/auth/protected-route';

export default function QmsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute module="qms">
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}
