'use client';

import { ParameterAccessGuard } from '@/components/admin/parameters/parameter-access-guard';
import { ParameterDetailView } from '@/components/admin/parameters/parameter-detail-view';

export default function ParameterDetailPage({ params }: { params: { id: string } }) {
  return (
    <ParameterAccessGuard>
      <ParameterDetailView id={params.id} />
    </ParameterAccessGuard>
  );
}
