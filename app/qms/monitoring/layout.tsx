'use client';

import { MonitoringSubNav } from '@/components/monitoring-mgmt/monitoring-sub-nav';

export default function MonitoringLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <MonitoringSubNav />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
