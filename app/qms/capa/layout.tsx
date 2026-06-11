'use client';

import { CapaSubNav } from '@/components/capa/capa-sub-nav';

export default function CapaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <CapaSubNav />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
