'use client';

import { DesignationAccessGuard } from '@/components/admin/designations/designation-access-guard';
import { DesignationsListPage } from '@/components/admin/designations/designations-list-page';

export default function AdminDesignationsPage() {
  return (
    <DesignationAccessGuard>
      <DesignationsListPage />
    </DesignationAccessGuard>
  );
}
