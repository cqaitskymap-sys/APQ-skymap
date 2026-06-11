'use client';

import { TmsSubNav } from '@/components/training/tms-sub-nav';

export default function TrainingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <TmsSubNav />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
