'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { BackupStatusBadge } from './backup-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/auth-context';
import type { BackupHistory, RestoreHistory } from '@/lib/admin/schemas';
import {
  fetchBackupHistory, fetchRestoreHistory,
  exportBackupHistoryCsv, exportRestoreHistoryCsv,
  buildBackupHistoryPdfHtml, buildRestoreHistoryPdfHtml,
  logBackupExport,
} from '@/lib/admin/backup-service';

export function BackupHistoryPage() {
  const { user, profile } = useAuth();
  const [backups, setBackups] = useState<BackupHistory[]>([]);
  const [restores, setRestores] = useState<RestoreHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const auditMeta = {
    userId: user?.uid || 'system',
    userName: profile?.full_name || profile?.email || 'Admin',
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, r] = await Promise.all([fetchBackupHistory(), fetchRestoreHistory()]);
      setBackups(b);
      setRestores(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sortedBackups = useMemo(() =>
    [...backups].sort((a, b) => String(b.backupDateTime).localeCompare(String(a.backupDateTime))),
  [backups]);

  const sortedRestores = useMemo(() =>
    [...restores].sort((a, b) => String(b.restoreDateTime).localeCompare(String(a.restoreDateTime))),
  [restores]);

  const exportBackupPdf = async () => {
    const html = buildBackupHistoryPdfHtml(sortedBackups, auditMeta.userName);
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
    await logBackupExport('backup history pdf', auditMeta, sortedBackups.length);
    toast.success('PDF report opened');
  };

  const exportRestorePdf = async () => {
    const html = buildRestoreHistoryPdfHtml(sortedRestores, auditMeta.userName);
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
    await logBackupExport('restore history pdf', auditMeta, sortedRestores.length);
    toast.success('PDF report opened');
  };

  const exportBackupExcel = async () => {
    const csv = exportBackupHistoryCsv(sortedBackups);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_history_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    await logBackupExport('backup history excel', auditMeta, sortedBackups.length);
    toast.success('Exported');
  };

  if (loading) return <LoadingSkeleton rows={4} />;
  if (error) return <ErrorCard message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Backup & Restore History"
        description="Complete backup and restore audit log for disaster recovery"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/backup"><ArrowLeft className="h-4 w-4 mr-1" />Dashboard</Link>
          </Button>
        }
      />

      <Tabs defaultValue="backups">
        <TabsList>
          <TabsTrigger value="backups">Backup History ({sortedBackups.length})</TabsTrigger>
          <TabsTrigger value="restores">Restore History ({sortedRestores.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="backups" className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportBackupPdf}><Printer className="h-4 w-4 mr-1" />PDF</Button>
            <Button variant="outline" size="sm" onClick={exportBackupExcel}><Download className="h-4 w-4 mr-1" />Excel</Button>
          </div>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Records</TableHead>
                    <TableHead>Created By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedBackups.length === 0 ? (
                    <TableRow><TableCell colSpan={8}><EmptyState title="No backup history" /></TableCell></TableRow>
                  ) : sortedBackups.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>
                        <Link href={`/admin/backup/${b.id}`} className="hover:underline font-medium">{b.backupNumber}</Link>
                      </TableCell>
                      <TableCell>{new Date(b.backupDateTime).toLocaleString()}</TableCell>
                      <TableCell>{b.backupType}</TableCell>
                      <TableCell>{b.backupScope}</TableCell>
                      <TableCell><BackupStatusBadge status={b.backupStatus} /></TableCell>
                      <TableCell>{b.fileSize}</TableCell>
                      <TableCell>{b.recordsCount}</TableCell>
                      <TableCell>{b.createdBy}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="restores" className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportRestorePdf}><Printer className="h-4 w-4 mr-1" />PDF</Button>
            <Button variant="outline" size="sm" onClick={async () => {
              const csv = exportRestoreHistoryCsv(sortedRestores);
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `restore_history_${new Date().toISOString().split('T')[0]}.csv`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success('Exported');
            }}><Download className="h-4 w-4 mr-1" />Excel</Button>
          </div>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Restore ID</TableHead>
                    <TableHead>Backup ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Records</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Approved By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRestores.length === 0 ? (
                    <TableRow><TableCell colSpan={8}><EmptyState title="No restore history" /></TableCell></TableRow>
                  ) : sortedRestores.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.restoreId}</TableCell>
                      <TableCell>{r.backupId}</TableCell>
                      <TableCell>{new Date(r.restoreDateTime).toLocaleString()}</TableCell>
                      <TableCell>{r.restoreType}</TableCell>
                      <TableCell><BackupStatusBadge status={r.restoreStatus} /></TableCell>
                      <TableCell>{r.recordsRestored}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.reasonForRestore}</TableCell>
                      <TableCell>{r.approvedBy || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
