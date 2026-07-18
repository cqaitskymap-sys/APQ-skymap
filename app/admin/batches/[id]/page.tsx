'use client';;
import { use } from "react";

import { BatchAccessGuard } from '@/components/admin/batches/batch-access-guard';
import { BatchDetailView } from '@/components/admin/batches/batch-detail-view';

export default function BatchDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  return (
    <BatchAccessGuard>
      <BatchDetailView id={params.id} />
    </BatchAccessGuard>
  );
}
