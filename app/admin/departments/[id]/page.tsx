'use client';

import { DepartmentAccessGuard } from '@/components/admin/departments/department-access-guard';
import { DepartmentDetailView } from '@/components/admin/departments/department-detail-view';

export default function DepartmentDetailPage({ params }: { params: { id: string } }) {
  return (
    <DepartmentAccessGuard>
      <DepartmentDetailView id={params.id} />
    </DepartmentAccessGuard>
  );
}
