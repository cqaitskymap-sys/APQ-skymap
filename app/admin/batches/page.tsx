'use client';

import { BatchAccessGuard } from '@/components/admin/batches/batch-access-guard';
import { BatchesListPage } from '@/components/admin/batches/batches-list-page';

export default function AdminBatchesPage() {
  return (
    <BatchAccessGuard>
      <BatchesListPage />
    </BatchAccessGuard>
  );
}
