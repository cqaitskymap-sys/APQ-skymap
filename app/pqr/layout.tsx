'use client';

import { AppShell } from '@/components/layout/AppShell';
import { ProtectedRoute } from '@/components/auth/protected-route';

export default function PqrLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute module="pqr">
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}
