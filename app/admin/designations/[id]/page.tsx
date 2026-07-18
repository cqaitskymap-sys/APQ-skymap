'use client';;
import { use } from "react";

import { DesignationAccessGuard } from '@/components/admin/designations/designation-access-guard';
import { DesignationDetailView } from '@/components/admin/designations/designation-detail-view';

export default function DesignationDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  return (
    <DesignationAccessGuard>
      <DesignationDetailView id={params.id} />
    </DesignationAccessGuard>
  );
}
