'use client';

import { ApprovalMatrixAccessGuard } from '@/components/admin/approval-matrix/approval-matrix-access-guard';
import { ApprovalMatricesListPage } from '@/components/admin/approval-matrix/approval-matrices-list-page';

export default function AdminApprovalMatrixPage() {
  return (
    <ApprovalMatrixAccessGuard>
      <ApprovalMatricesListPage />
    </ApprovalMatrixAccessGuard>
  );
}
