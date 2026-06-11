'use client';

import { AuditSubNav } from '@/components/audit-mgmt/audit-sub-nav';

export default function AuditLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <AuditSubNav />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
