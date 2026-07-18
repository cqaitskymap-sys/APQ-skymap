'use client';;
import { use } from "react";

import { DepartmentAccessGuard } from '@/components/admin/departments/department-access-guard';
import { DepartmentDetailView } from '@/components/admin/departments/department-detail-view';

export default function DepartmentDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  return (
    <DepartmentAccessGuard>
      <DepartmentDetailView id={params.id} />
    </DepartmentAccessGuard>
  );
}
