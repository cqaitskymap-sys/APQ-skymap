'use client';

import { useState, useEffect } from 'react';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminAuthGuard } from '@/components/admin/admin-auth-guard';
import { Header } from '@/components/layout/header';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { seedDefaultData } from '@/lib/admin/admin-service';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, isDemoMode } = useAuth();

  useEffect(() => {
    if (user?.uid && !isDemoMode) {
      seedDefaultData(user.uid).catch(console.error);
    }
  }, [user?.uid, isDemoMode]);

  return (
    <AdminAuthGuard>
      <div className="flex h-screen bg-slate-100/50 dark:bg-slate-950 overflow-hidden">
        <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header />
          <main className={cn('flex-1 overflow-y-auto scrollbar-thin')}>
            <div className="p-4 sm:p-6 min-h-full max-w-[1600px] mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </AdminAuthGuard>
  );
}
