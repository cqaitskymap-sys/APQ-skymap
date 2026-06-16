'use client';

import { WorkflowAccessGuard } from '@/components/admin/workflows/workflow-access-guard';
import { WorkflowDetailView } from '@/components/admin/workflows/workflow-detail-view';

export default function WorkflowDetailPage({ params }: { params: { id: string } }) {
  return (
    <WorkflowAccessGuard>
      <WorkflowDetailView id={params.id} />
    </WorkflowAccessGuard>
  );
}
