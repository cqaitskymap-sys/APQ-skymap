'use client';
import { use } from "react";

import { UserAccessGuard } from '@/components/admin/users/user-access-guard';
import { UserDetailView } from '@/components/admin/users/user-detail-view';

export default function UserDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  return (
    <UserAccessGuard>
      <UserDetailView userId={params.id} />
    </UserAccessGuard>
  );
}
