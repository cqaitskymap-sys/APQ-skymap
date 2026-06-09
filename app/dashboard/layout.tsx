'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { cn } from '@/lib/utils';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden flex-col">
      <div className="flex flex-1 min-w-0 overflow-hidden">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header />
          <main className={cn(
            'flex-1 overflow-y-auto',
            'scrollbar-thin'
          )}>
            <div className="p-6 min-h-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
