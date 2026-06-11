'use client';

import { ComplaintSubNav } from '@/components/complaints/complaint-sub-nav';

export default function ComplaintsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <ComplaintSubNav />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
