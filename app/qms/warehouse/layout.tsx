'use client';

import { WarehouseSubNav } from '@/components/warehouse-mgmt/warehouse-sub-nav';

export default function WarehouseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <WarehouseSubNav />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
