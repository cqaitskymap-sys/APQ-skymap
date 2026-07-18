'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminAuthGuard } from '@/components/admin/admin-auth-guard';
import { Header } from '@/components/layout/header';
import { PageTransition } from '@/components/loading/page-transition';
import { cn } from '@/lib/utils';

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <AdminAuthGuard>
      <div className="flex h-screen bg-slate-100/50 dark:bg-slate-950 overflow-hidden">
        <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header />
          <main className={cn('flex-1 overflow-y-auto scrollbar-thin')}>
            <PageTransition routeKey={pathname ?? 'admin'} variant="fade" className="p-4 sm:p-6 min-h-full max-w-[1600px] mx-auto">
              {children}
            </PageTransition>
          </main>
        </div>
      </div>
    </AdminAuthGuard>
  );
}
