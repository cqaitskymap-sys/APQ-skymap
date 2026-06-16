'use client';

import { AuditTrailAccessGuard } from '@/components/admin/audit-trail/audit-trail-access-guard';
import { AuditTrailListPage } from '@/components/admin/audit-trail/audit-trail-list-page';

export default function AdminAuditTrailPage() {
  return (
    <AuditTrailAccessGuard>
      <AuditTrailListPage />
    </AuditTrailAccessGuard>
  );
}
