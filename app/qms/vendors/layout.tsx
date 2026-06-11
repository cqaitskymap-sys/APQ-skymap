'use client';

import { VendorSubNav } from '@/components/vendor-mgmt/vendor-sub-nav';

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <VendorSubNav />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
