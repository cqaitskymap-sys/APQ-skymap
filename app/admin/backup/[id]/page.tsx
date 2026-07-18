'use client';

import { useCallback, useEffect, useState, use } from 'react';
import { BackupAccessGuard } from '@/components/admin/backup/backup-access-guard';
import { BackupDetailView } from '@/components/admin/backup/backup-detail-view';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { useAuth } from '@/contexts/auth-context';
import type { BackupHistory } from '@/lib/admin/schemas';
import { fetchBackupById } from '@/lib/admin/backup-service';

function BackupDetailContent({ id }: { id: string }) {
  const { user, profile } = useAuth();
  const [backup, setBackup] = useState<BackupHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const auditMeta = {
    userId: user?.uid || 'system',
    userName: profile?.full_name || profile?.email || 'Admin',
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const b = await fetchBackupById(id);
      if (!b) setError('Backup not found');
      else setBackup(b);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSkeleton rows={3} />;
  if (error || !backup) return <ErrorCard message={error || 'Backup not found'} onRetry={load} />;

  return <BackupDetailView backup={backup} auditMeta={auditMeta} onRefresh={load} />;
}

export default function BackupDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  return (
    <BackupAccessGuard>
      <BackupDetailContent id={params.id} />
    </BackupAccessGuard>
  );
}
