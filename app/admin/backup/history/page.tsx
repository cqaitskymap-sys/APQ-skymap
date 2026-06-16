'use client';

import { BackupAccessGuard } from '@/components/admin/backup/backup-access-guard';
import { BackupHistoryPage } from '@/components/admin/backup/backup-history-page';

export default function AdminBackupHistoryPage() {
  return (
    <BackupAccessGuard>
      <BackupHistoryPage />
    </BackupAccessGuard>
  );
}
