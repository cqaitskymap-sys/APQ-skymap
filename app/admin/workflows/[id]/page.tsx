'use client';;
import { use } from "react";

import { WorkflowAccessGuard } from '@/components/admin/workflows/workflow-access-guard';
import { WorkflowDetailView } from '@/components/admin/workflows/workflow-detail-view';

export default function WorkflowDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  return (
    <WorkflowAccessGuard>
      <WorkflowDetailView id={params.id} />
    </WorkflowAccessGuard>
  );
}
