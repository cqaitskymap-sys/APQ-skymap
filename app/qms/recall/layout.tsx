'use client';

import { RecallSubNav } from '@/components/recall/recall-sub-nav';

export default function RecallLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <RecallSubNav />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
