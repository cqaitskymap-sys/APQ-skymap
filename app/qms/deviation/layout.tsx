'use client';

import { DeviationSubNav } from '@/components/deviations/deviation-sub-nav';

export default function DeviationLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <DeviationSubNav />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
