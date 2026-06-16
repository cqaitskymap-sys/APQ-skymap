'use client';

import { UserAccessGuard } from '@/components/admin/users/user-access-guard';
import { UserDetailView } from '@/components/admin/users/user-detail-view';

export default function UserDetailPage({ params }: { params: { id: string } }) {
  return (
    <UserAccessGuard>
      <UserDetailView userId={params.id} />
    </UserAccessGuard>
  );
}
