'use client';;
import { use } from "react";

import { ApprovalMatrixAccessGuard } from '@/components/admin/approval-matrix/approval-matrix-access-guard';
import { ApprovalMatrixDetailView } from '@/components/admin/approval-matrix/approval-matrix-detail-view';

export default function ApprovalMatrixDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  return (
    <ApprovalMatrixAccessGuard>
      <ApprovalMatrixDetailView id={params.id} />
    </ApprovalMatrixAccessGuard>
  );
}
