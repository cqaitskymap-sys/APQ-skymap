'use client';

import { AppShell } from '@/components/layout/AppShell';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { TmsSubNav } from '@/components/training/tms-sub-nav';

export default function TrainingLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute module="training">
      <AppShell>
        <div className="flex flex-col lg:flex-row gap-6">
          <TmsSubNav />
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
