'use client';

import { AppShell } from '@/components/layout/AppShell';
import { ProtectedRoute } from '@/components/auth/protected-route';

export function CpvShell({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute module="cpv">
      <AppShell>
        <div className="mx-auto min-h-full max-w-[1600px]">{children}</div>
      </AppShell>
    </ProtectedRoute>
  );
}
