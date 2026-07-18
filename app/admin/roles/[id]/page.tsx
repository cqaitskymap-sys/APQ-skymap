'use client';;
import { use } from "react";

import { RoleAccessGuard } from '@/components/admin/roles/role-access-guard';
import { RoleDetailView } from '@/components/admin/roles/role-detail-view';

export default function RoleDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  return (
    <RoleAccessGuard>
      <RoleDetailView id={params.id} />
    </RoleAccessGuard>
  );
}
