'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { BackupAccessGuard } from '@/components/admin/backup/backup-access-guard';
import { BackupForm } from '@/components/admin/backup/backup-form';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canCreateBackup } from '@/lib/permissions';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import type { BackupFormData } from '@/lib/admin/schemas';
import { createBackup } from '@/lib/admin/backup-service';

function CreateBackupContent() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { role } = useAdminPermissions();
  const canCreate = canCreateBackup(role);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');

  const auditMeta = {
    userId: user?.uid || 'system',
    userName: profile?.full_name || profile?.email || 'Admin',
  };

  if (!canCreate) {
    return <ErrorCard accessDenied message="You do not have permission to create backups." />;
  }

  const handleSubmit = async (data: BackupFormData) => {
    setSubmitting(true);
    const result = await createBackup(data, auditMeta, (pct, label) => {
      setProgress(pct);
      setProgressLabel(label);
    });
    setSubmitting(false);
    if (result.backup?.id) {
      toast.success('Backup created successfully');
      router.push(`/admin/backup/${result.backup.id}`);
    } else {
      toast.error(result.error || 'Backup failed');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Manual Backup"
        description="Export Firestore collections to JSON and store in Firebase Storage"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/backup"><ArrowLeft className="h-4 w-4 mr-1" />Back</Link>
          </Button>
        }
      />
      <BackupForm
        onSubmit={handleSubmit}
        onCancel={() => router.push('/admin/backup')}
        submitting={submitting}
        progress={progress}
        progressLabel={progressLabel}
      />
    </div>
  );
}

export default function CreateBackupPage() {
  return (
    <BackupAccessGuard>
      <CreateBackupContent />
    </BackupAccessGuard>
  );
}
