'use client';

import { useState } from 'react';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminAuthGuard } from '@/components/admin/admin-auth-guard';
import { Header } from '@/components/layout/header';
import { cn } from '@/lib/utils';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

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
