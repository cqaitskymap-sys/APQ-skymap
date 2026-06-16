'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { BackupStatusBadge } from './backup-status-badge';
import { RestoreWarningModal } from './restore-warning-modal';
import { ESignatureModal } from '@/components/shared/esignature-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/contexts/auth-context';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canApproveRestore } from '@/lib/permissions';
import { RESTORE_TYPES, BACKUP_EXPORT_COLLECTIONS } from '@/lib/admin/constants';
import {
  restoreRequestFormSchema, type RestoreRequestFormData, type RestoreHistory, type BackupHistory,
} from '@/lib/admin/schemas';
import {
  fetchBackupHistory, fetchRestoreHistory, requestRestore,
  approveRestore, rejectRestore,
} from '@/lib/admin/backup-service';

export function BackupRestorePage() {
  const { user, profile } = useAuth();
  const { role } = useAdminPermissions();
  const canApprove = canApproveRestore(role);
  const searchParams = useSearchParams();
  const preselectedBackup = searchParams.get('backupId');

  const [backups, setBackups] = useState<BackupHistory[]>([]);
  const [restores, setRestores] = useState<RestoreHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warningOpen, setWarningOpen] = useState(false);
  const [esignOpen, setEsignOpen] = useState(false);
  const [pendingForm, setPendingForm] = useState<RestoreRequestFormData | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const auditMeta = {
    userId: user?.uid || 'system',
    userName: profile?.full_name || profile?.email || 'Admin',
  };

  const form = useForm<RestoreRequestFormData>({
    resolver: zodResolver(restoreRequestFormSchema),
    defaultValues: {
      backupId: preselectedBackup || '',
      restoreType: 'Full Restore',
      selectedCollections: [],
      reasonForRestore: '',
      remarks: '',
    },
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, r] = await Promise.all([fetchBackupHistory(), fetchRestoreHistory()]);
      setBackups(b.filter((x) => x.backupStatus === 'Completed' || x.backupStatus === 'Verified'));
      setRestores(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (preselectedBackup) form.setValue('backupId', preselectedBackup);
  }, [preselectedBackup, form]);

  const restoreType = form.watch('restoreType');
  const selectedCols = form.watch('selectedCollections');
  const selectedBackup = backups.find((b) => b.backupId === form.watch('backupId'));

  const toggleCollection = (col: string) => {
    const next = selectedCols.includes(col) ? selectedCols.filter((c) => c !== col) : [...selectedCols, col];
    form.setValue('selectedCollections', next);
  };

  const onFormSubmit = (data: RestoreRequestFormData) => {
    setPendingForm(data);
    setWarningOpen(true);
  };

  const afterWarning = () => {
    setWarningOpen(false);
    setEsignOpen(true);
  };

  const submitRestoreRequest = async () => {
    if (!pendingForm) return;
    setSubmitting(true);
    const result = await requestRestore(pendingForm, auditMeta);
    setSubmitting(false);
    setEsignOpen(false);
    setPendingForm(null);
    if (result.restore) {
      toast.success('Restore request submitted — awaiting Super Admin approval');
      form.reset();
      load();
    } else toast.error(result.error || 'Failed to submit restore request');
  };

  const handleApprove = async (restore: RestoreHistory) => {
    setEsignOpen(true);
    setPendingForm({
      backupId: restore.backupId,
      restoreType: restore.restoreType,
      selectedCollections: restore.collectionsRestored,
      reasonForRestore: restore.reasonForRestore,
      remarks: restore.restoreId,
    });
  };

  const handleEsignSuccess = async () => {
    if (!pendingForm) return;
    if (pendingForm.remarks?.startsWith('RST-')) {
      const restore = restores.find((r) => r.restoreId === pendingForm.remarks);
      if (restore) {
        const result = await approveRestore(restore, auditMeta);
        if (result.success) toast.success('Restore approved and executed');
        else toast.error(result.error || 'Restore failed');
        load();
      }
    } else {
      await submitRestoreRequest();
    }
    setEsignOpen(false);
    setPendingForm(null);
  };

  const pendingRequests = restores.filter((r) => r.restoreStatus === 'Requested');

  if (loading) return <LoadingSkeleton rows={3} />;
  if (error) return <ErrorCard message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Restore from Backup"
        description="Request disaster recovery restore with Super Admin approval and e-signature"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/backup"><ArrowLeft className="h-4 w-4 mr-1" />Dashboard</Link>
          </Button>
        }
      />

      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="p-4 text-sm">
          <p className="font-medium text-amber-800">Safety Notice</p>
          <p className="text-amber-700 mt-1">
            Restore requires Super Admin approval, e-signature, and reason. A pre-restore backup is created automatically.
            Audit trail records are never deleted or overwritten.
          </p>
        </CardContent>
      </Card>

      {canApprove && pendingRequests.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Pending Restore Requests</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Restore ID</TableHead>
                  <TableHead>Backup</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.restoreId}</TableCell>
                    <TableCell>{r.backupId}</TableCell>
                    <TableCell>{r.restoreType}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{r.reasonForRestore}</TableCell>
                    <TableCell>{r.restoredBy}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" className="bg-green-600" onClick={() => handleApprove(r)}>
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={async () => {
                        await rejectRestore(r, auditMeta, 'Rejected by Super Admin');
                        toast.info('Restore rejected');
                        load();
                      }}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">New Restore Request</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-4 max-w-2xl">
            <div className="space-y-2">
              <Label>Backup *</Label>
              <Select value={form.watch('backupId')} onValueChange={(v) => form.setValue('backupId', v)}>
                <SelectTrigger><SelectValue placeholder="Select backup" /></SelectTrigger>
                <SelectContent>
                  {backups.map((b) => (
                    <SelectItem key={b.backupId} value={b.backupId}>
                      {b.backupNumber} — {new Date(b.backupDateTime).toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.backupId && (
                <p className="text-xs text-red-500">{form.formState.errors.backupId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Restore Type *</Label>
              <Select value={restoreType} onValueChange={(v) => form.setValue('restoreType', v as RestoreRequestFormData['restoreType'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RESTORE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {restoreType === 'Selected Collection Restore' && (
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded p-3">
                {BACKUP_EXPORT_COLLECTIONS.filter((c) => c !== 'audit_trail').map((col) => (
                  <label key={col} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={selectedCols.includes(col)} onCheckedChange={() => toggleCollection(col)} />
                    {col}
                  </label>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Label>Reason for Restore *</Label>
              <Textarea {...form.register('reasonForRestore')} rows={3} placeholder="GMP justification required..." />
              {form.formState.errors.reasonForRestore && (
                <p className="text-xs text-red-500">{form.formState.errors.reasonForRestore.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea {...form.register('remarks')} rows={2} />
            </div>

            <Button type="submit" disabled={submitting} className="bg-red-600">
              {submitting ? 'Submitting...' : 'Submit Restore Request'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent Restore Activity</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Restore ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Records</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {restores.slice(0, 10).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.restoreId}</TableCell>
                  <TableCell><BackupStatusBadge status={r.restoreStatus} /></TableCell>
                  <TableCell>{new Date(r.restoreDateTime).toLocaleString()}</TableCell>
                  <TableCell>{r.recordsRestored}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RestoreWarningModal
        open={warningOpen}
        onOpenChange={setWarningOpen}
        onConfirm={afterWarning}
        backupNumber={selectedBackup?.backupNumber}
        restoreType={pendingForm?.restoreType}
      />

      <ESignatureModal
        open={esignOpen}
        onOpenChange={setEsignOpen}
        moduleName="Admin"
        recordId={pendingForm?.backupId || 'restore'}
        actionType="Restore"
        signatureMeaning="I authorize this restore operation and confirm data integrity review"
        onSuccess={handleEsignSuccess}
        onCancel={() => { setPendingForm(null); setEsignOpen(false); }}
      />
    </div>
  );
}
