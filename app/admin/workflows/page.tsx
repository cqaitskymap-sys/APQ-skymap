'use client';

import { WorkflowAccessGuard } from '@/components/admin/workflows/workflow-access-guard';
import { WorkflowsListPage } from '@/components/admin/workflows/workflows-list-page';

export default function AdminWorkflowsPage() {
  return (
    <WorkflowAccessGuard>
      <WorkflowsListPage />
    </WorkflowAccessGuard>
  );
}
