'use client';

import { OosSubNav } from '@/components/oos/oos-sub-nav';

export default function OosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <OosSubNav />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
