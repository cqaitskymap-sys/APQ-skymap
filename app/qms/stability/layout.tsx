'use client';

import { StabilitySubNav } from '@/components/stability/stability-sub-nav';

export default function StabilityLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <StabilitySubNav />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
