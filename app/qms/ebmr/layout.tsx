'use client';

import { EbmrSubNav } from '@/components/ebmr-mgmt/ebmr-sub-nav';

export default function EbmrLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <EbmrSubNav />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
