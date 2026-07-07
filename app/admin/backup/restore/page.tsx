'use client';

import { Suspense } from 'react';
import { BackupAccessGuard } from '@/components/admin/backup/backup-access-guard';
import { BackupRestorePage } from '@/components/admin/backup/backup-restore-page';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';

export default function AdminBackupRestorePage() {
  return (
    <BackupAccessGuard>
      <Suspense fallback={<LoadingSkeleton rows={3} />}>
        <BackupRestorePage />
      </Suspense>
    </BackupAccessGuard>
  );
}