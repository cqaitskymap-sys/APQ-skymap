'use client';

import { RoleAccessGuard } from '@/components/admin/roles/role-access-guard';
import { RolesListPage } from '@/components/admin/roles/roles-list-page';

export default function AdminRolesPage() {
  return (
    <RoleAccessGuard>
      <RolesListPage />
    </RoleAccessGuard>
  );
}
