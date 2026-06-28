'use client';

import { DmsSubNav } from '@/components/dms/dms-sub-nav';

export default function DocumentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <DmsSubNav />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
