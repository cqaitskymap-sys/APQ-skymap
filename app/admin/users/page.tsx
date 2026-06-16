'use client';

import { UserAccessGuard } from '@/components/admin/users/user-access-guard';
import { UsersListPage } from '@/components/admin/users/users-list-page';

export default function AdminUsersPage() {
  return (
    <UserAccessGuard>
      <UsersListPage />
    </UserAccessGuard>
  );
}
