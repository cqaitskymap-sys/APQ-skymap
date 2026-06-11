'use client';

import { ReactNode, useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children: ReactNode;
  className?: string;
}

export function AppShell({ children, className }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <div className="flex min-w-0 flex-1 overflow-hidden">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Header />
          <main className={cn('flex-1 overflow-y-auto', className)}>
            <div className="min-h-full p-4 md:p-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default AppShell;
