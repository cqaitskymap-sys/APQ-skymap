'use client';

import { DepartmentAccessGuard } from '@/components/admin/departments/department-access-guard';
import { DepartmentsListPage } from '@/components/admin/departments/departments-list-page';

export default function AdminDepartmentsPage() {
  return (
    <DepartmentAccessGuard>
      <DepartmentsListPage />
    </DepartmentAccessGuard>
  );
}
