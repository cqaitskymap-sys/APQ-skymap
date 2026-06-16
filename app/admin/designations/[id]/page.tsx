'use client';

import { DesignationAccessGuard } from '@/components/admin/designations/designation-access-guard';
import { DesignationDetailView } from '@/components/admin/designations/designation-detail-view';

export default function DesignationDetailPage({ params }: { params: { id: string } }) {
  return (
    <DesignationAccessGuard>
      <DesignationDetailView id={params.id} />
    </DesignationAccessGuard>
  );
}
