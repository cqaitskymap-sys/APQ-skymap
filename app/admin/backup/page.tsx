'use client';

import { BackupAccessGuard } from '@/components/admin/backup/backup-access-guard';
import { BackupDashboardPage } from '@/components/admin/backup/backup-dashboard-page';

export default function AdminBackupPage() {
  return (
    <BackupAccessGuard>
      <BackupDashboardPage />
    </BackupAccessGuard>
  );
}
