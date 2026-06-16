'use client';

import { BackupAccessGuard } from '@/components/admin/backup/backup-access-guard';
import { BackupRestorePage } from '@/components/admin/backup/backup-restore-page';

export default function AdminBackupRestorePage() {
  return (
    <BackupAccessGuard>
      <BackupRestorePage />
    </BackupAccessGuard>
  );
}
