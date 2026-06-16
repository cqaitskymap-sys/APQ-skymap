'use client';

import { ApprovalMatrixAccessGuard } from '@/components/admin/approval-matrix/approval-matrix-access-guard';
import { ApprovalMatrixDetailView } from '@/components/admin/approval-matrix/approval-matrix-detail-view';

export default function ApprovalMatrixDetailPage({ params }: { params: { id: string } }) {
  return (
    <ApprovalMatrixAccessGuard>
      <ApprovalMatrixDetailView id={params.id} />
    </ApprovalMatrixAccessGuard>
  );
}
