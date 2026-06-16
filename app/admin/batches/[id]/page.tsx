'use client';

import { BatchAccessGuard } from '@/components/admin/batches/batch-access-guard';
import { BatchDetailView } from '@/components/admin/batches/batch-detail-view';

export default function BatchDetailPage({ params }: { params: { id: string } }) {
  return (
    <BatchAccessGuard>
      <BatchDetailView id={params.id} />
    </BatchAccessGuard>
  );
}
