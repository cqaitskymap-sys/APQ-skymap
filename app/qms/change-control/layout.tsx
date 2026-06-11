'use client';

import { CcSubNav } from '@/components/change-control/cc-sub-nav';

export default function ChangeControlLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <CcSubNav />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
