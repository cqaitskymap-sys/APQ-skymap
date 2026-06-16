'use client';

import { ParameterAccessGuard } from '@/components/admin/parameters/parameter-access-guard';
import { ParametersListPage } from '@/components/admin/parameters/parameters-list-page';

export default function AdminParametersPage() {
  return (
    <ParameterAccessGuard>
      <ParametersListPage />
    </ParameterAccessGuard>
  );
}
