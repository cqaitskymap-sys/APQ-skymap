'use client';

import { EquipmentSubNav } from '@/components/equipment-mgmt/equipment-sub-nav';

export default function EquipmentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <EquipmentSubNav />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
