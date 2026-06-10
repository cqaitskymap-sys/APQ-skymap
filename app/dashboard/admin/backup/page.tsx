'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Database, Download, RotateCcw, Clock, Save } from 'lucide-react';
import { toast } from 'sonner';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminAuthGuard } from '@/components/admin/admin-auth-guard';
import { AdminDataTable, ColumnDef } from '@/components/admin/admin-data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/auth-context';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { getAdminRecords, createAdminRecord } from '@/lib/admin/admin-service';
import { ADMIN_COLLECTIONS } from '@/lib/admin/constants';
import type { BackupHistory } from '@/lib/admin/schemas';
import { collection, getDocs } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';

export default function BackupPage() {
  return (
    <AdminAuthGuard>
      <BackupContent />
    </AdminAuthGuard>
  );
}

function BackupContent() {
  const { user, profile } = useAuth();
  const { canRestoreBackup } = useAdminPermissions();
  const [history, setHistory] = useState<BackupHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoSchedule, setAutoSchedule] = useState({ enabled: false, frequency: 'daily', time: '02:00' });
  const [backing, setBacking] = useState(false);

  const auditMeta = {
    userId: user?.uid || 'system',
    userName: profile?.full_name || 'Admin',
    module: 'Admin' as const,
  };

  const loadHistory = async () => {
    setLoading(true);
    const data = await getAdminRecords<BackupHistory>(ADMIN_COLLECTIONS.backupHistory);
    setHistory(data);
    setLoading(false);
  };

  useEffect(() => { loadHistory(); }, []);

  const runManualBackup = async () => {
    setBacking(true);
    try {
      const collections = Object.values(ADMIN_COLLECTIONS);
      const backup: Record<string, unknown[]> = {};

      for (const col of collections) {
        const snap = await getDocs(collection(firestore, col));
        backup[col] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }

      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const backupId = `BK-${Date.now()}`;

      await createAdminRecord(ADMIN_COLLECTIONS.backupHistory, {
        backupId,
        backupDate: new Date().toISOString(),
        backupType: 'Manual',
        fileSize: `${(blob.size / 1024).toFixed(1)} KB`,
        filePath: backupId,
        status: 'Active',
      }, auditMeta);

      const a = document.createElement('a');
      a.href = url;
      a.download = `${backupId}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success('Backup completed and downloaded');
      loadHistory();
    } catch {
      toast.error('Backup failed');
    } finally {
      setBacking(false);
    }
  };

  const columns: ColumnDef<BackupHistory>[] = [
    { key: 'backupId', header: 'Backup ID' },
    { key: 'backupDate', header: 'Date', render: (r) => new Date(r.backupDate).toLocaleString() },
    { key: 'backupType', header: 'Type' },
    { key: 'createdBy', header: 'Created By' },
    { key: 'fileSize', header: 'Size' },
    { key: 'status', header: 'Status' },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Backup & Restore"
        description="Manual and scheduled backup of QMS configuration and master data"
      />

      <Tabs defaultValue="manual" className="space-y-6">
        <TabsList>
          <TabsTrigger value="manual">Manual Backup</TabsTrigger>
          <TabsTrigger value="schedule">Auto Schedule</TabsTrigger>
          <TabsTrigger value="history">Backup History</TabsTrigger>
        </TabsList>

        <TabsContent value="manual">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Database className="h-5 w-5" />Manual Backup</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Creates a JSON export of all admin collections including users, roles, master data, and settings.
              </p>
              <Button onClick={runManualBackup} disabled={backing} className="bg-blue-600">
                <Download className="h-4 w-4 mr-2" />
                {backing ? 'Creating Backup...' : 'Download Backup'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="h-5 w-5" />Auto Backup Schedule</CardTitle></CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <div className="flex items-center justify-between">
                <Label>Enable Automatic Backup</Label>
                <Switch checked={autoSchedule.enabled} onCheckedChange={(v) => setAutoSchedule({ ...autoSchedule, enabled: v })} />
              </div>
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Input value={autoSchedule.frequency} onChange={(e) => setAutoSchedule({ ...autoSchedule, frequency: e.target.value })} placeholder="daily / weekly" />
              </div>
              <div className="space-y-2">
                <Label>Time (UTC)</Label>
                <Input type="time" value={autoSchedule.time} onChange={(e) => setAutoSchedule({ ...autoSchedule, time: e.target.value })} />
              </div>
              <Button variant="outline"><Save className="h-4 w-4 mr-2" />Save Schedule</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <AdminDataTable columns={columns} data={history} loading={loading} />
        </TabsContent>
      </Tabs>

      {canRestoreBackup && (
        <Card className="mt-6 border-red-200">
          <CardHeader><CardTitle className="text-base text-red-700 flex items-center gap-2"><RotateCcw className="h-5 w-5" />Restore Backup (Super Admin Only)</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Upload a backup JSON file to restore system configuration. This action is irreversible.</p>
            <Input type="file" accept=".json" onChange={() => toast.info('Restore requires Firebase Admin SDK — contact system administrator')} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
