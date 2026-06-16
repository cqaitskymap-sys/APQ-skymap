'use client';

import { RoleAccessGuard } from '@/components/admin/roles/role-access-guard';
import { RoleDetailView } from '@/components/admin/roles/role-detail-view';

export default function RoleDetailPage({ params }: { params: { id: string } }) {
  return (
    <RoleAccessGuard>
      <RoleDetailView id={params.id} />
    </RoleAccessGuard>
  );
}
