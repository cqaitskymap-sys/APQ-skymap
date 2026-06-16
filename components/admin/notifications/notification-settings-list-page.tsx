'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Download, Eye, Pencil, UserCheck, UserX, Database } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { KpiCard } from '@/components/admin/dashboard/kpi-card';
import { StatusBadge } from '@/components/admin/dashboard/status-badge';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ModuleBadge } from '@/components/admin/workflows/module-badge';
import { PriorityBadge } from './priority-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/auth-context';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canEditNotificationSettings } from '@/lib/permissions';
import {
  NOTIFICATION_MODULES, NOTIFICATION_CHANNEL_TYPES, NOTIFICATION_PRIORITIES, RECORD_STATUSES,
} from '@/lib/admin/constants';
import type { NotificationSetting } from '@/lib/admin/schemas';
import {
  fetchNotificationSettings, getNotificationSettingsSummary, getNotificationDeliveryStats,
  setNotificationSettingStatus, exportNotificationSettingsCsv, logNotificationSettingsExport,
  seedDefaultNotificationSettings,
} from '@/lib/admin/notification-settings-service';

const PAGE_SIZE = 10;

export function NotificationSettingsListPage() {
  const { user, profile } = useAuth();
  const { role } = useAdminPermissions();
  const canEdit = canEditNotificationSettings(role);

  const [settings, setSettings] = useState<NotificationSetting[]>([]);
  const [deliveryStats, setDeliveryStats] = useState({ unreadNotifications: 0, failedNotifications: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [confirm, setConfirm] = useState<{ setting: NotificationSetting; activate: boolean } | null>(null);
  const [seeding, setSeeding] = useState(false);

  const auditMeta = {
    userId: user?.uid || 'system',
    userName: profile?.full_name || profile?.email || 'Admin',
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, delivery] = await Promise.all([
        fetchNotificationSettings(),
        getNotificationDeliveryStats(),
      ]);
      setSettings(list);
      setDeliveryStats(delivery);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return settings.filter((s) => {
      const matchSearch = !q ||
        s.notificationCode?.toLowerCase().includes(q) ||
        s.eventName?.toLowerCase().includes(q) ||
        s.moduleName?.toLowerCase().includes(q) ||
        s.recipientRole?.toLowerCase().includes(q);
      const matchModule = moduleFilter === 'all' || s.moduleName === moduleFilter;
      const matchType = typeFilter === 'all' || s.notificationType === typeFilter;
      const matchPriority = priorityFilter === 'all' || s.priority === priorityFilter;
      const matchStatus = statusFilter === 'all' || s.status === statusFilter;
      return matchSearch && matchModule && matchType && matchPriority && matchStatus;
    });
  }, [settings, search, moduleFilter, typeFilter, priorityFilter, statusFilter]);

  const stats = getNotificationSettingsSummary(settings);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginated = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const handleExport = async () => {
    const csv = exportNotificationSettingsCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notification-settings-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    await logNotificationSettingsExport(auditMeta, filtered.length);
    toast.success('Notification settings exported');
  };

  const handleSeed = async () => {
    setSeeding(true);
    const result = await seedDefaultNotificationSettings(auditMeta);
    setSeeding(false);
    toast.success(`Created ${result.created}, skipped ${result.skipped}`);
    load();
  };

  const runConfirm = async () => {
    if (!confirm) return;
    const status = confirm.activate ? 'Active' : 'Inactive';
    const result = await setNotificationSettingStatus(confirm.setting.id!, confirm.setting, status, auditMeta);
    if (result.success) {
      toast.success(`Rule ${status === 'Active' ? 'activated' : 'deactivated'}`);
      load();
    } else toast.error(result.error || 'Action failed');
    setConfirm(null);
  };

  if (loading) return <div><PageHeader title="Notification Settings" basePath="/admin" /><LoadingSkeleton rows={2} /></div>;
  if (error) return <ErrorCard message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification Settings"
        description="Configure in-app, email, escalation and reminder notifications"
        basePath="/admin"
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1" />Export</Button>
            {canEdit && (
              <>
                <Button variant="outline" size="sm" disabled={seeding} onClick={handleSeed}>
                  <Database className="h-4 w-4 mr-1" />{seeding ? 'Seeding...' : 'Seed Defaults'}
                </Button>
                <Button asChild size="sm" className="bg-sky-600 hover:bg-sky-700">
                  <Link href="/admin/notifications/create"><Plus className="h-4 w-4 mr-1" />Create Rule</Link>
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <KpiCard label="Total Rules" value={stats.total} />
        <KpiCard label="Active" value={stats.active} />
        <KpiCard label="Inactive" value={stats.inactive} />
        <KpiCard label="Critical" value={stats.critical} />
        <KpiCard label="Email Enabled" value={stats.emailEnabled} />
        <KpiCard label="In-App Enabled" value={stats.inAppEnabled} />
        <KpiCard label="Unread" value={deliveryStats.unreadNotifications} />
        <KpiCard label="Failed" value={deliveryStats.failedNotifications} />
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search event, module, recipient..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
            </div>
            <Select value={moduleFilter} onValueChange={(v) => { setModuleFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Module" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                {NOTIFICATION_MODULES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {NOTIFICATION_CHANNEL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[120px]"><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                {NOTIFICATION_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[120px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {RECORD_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="hidden md:block overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Code</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow><TableCell colSpan={7}><EmptyState title="No notification rules found" /></TableCell></TableRow>
                ) : (
                  paginated.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.notificationCode}</TableCell>
                      <TableCell className="text-sm">{row.eventName}</TableCell>
                      <TableCell><ModuleBadge module={row.moduleName} /></TableCell>
                      <TableCell className="text-xs">{row.notificationType}</TableCell>
                      <TableCell><PriorityBadge priority={row.priority} /></TableCell>
                      <TableCell><StatusBadge status={row.status} /></TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="ghost" size="icon"><Link href={`/admin/notifications/${row.id}`}><Eye className="h-4 w-4" /></Link></Button>
                          {canEdit && (
                            <>
                              <Button asChild variant="ghost" size="icon"><Link href={`/admin/notifications/${row.id}/edit`}><Pencil className="h-4 w-4" /></Link></Button>
                              {row.status === 'Active'
                                ? <Button variant="ghost" size="icon" onClick={() => setConfirm({ setting: row, activate: false })}><UserX className="h-4 w-4 text-amber-600" /></Button>
                                : <Button variant="ghost" size="icon" onClick={() => setConfirm({ setting: row, activate: true })}><UserCheck className="h-4 w-4 text-green-600" /></Button>}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="md:hidden space-y-3">
            {paginated.map((row) => (
              <Card key={row.id} className="border">
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between"><p className="font-mono text-sm font-semibold">{row.notificationCode}</p><StatusBadge status={row.status} /></div>
                  <p className="text-sm">{row.eventName}</p>
                  <div className="flex flex-wrap gap-2"><ModuleBadge module={row.moduleName} /><PriorityBadge priority={row.priority} /></div>
                  <div className="flex gap-2 pt-2">
                    <Button asChild size="sm" variant="outline"><Link href={`/admin/notifications/${row.id}`}>View</Link></Button>
                    {canEdit && <Button asChild size="sm" variant="outline"><Link href={`/admin/notifications/${row.id}/edit`}>Edit</Link></Button>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{filtered.length} rules</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setPage((p) => p - 1)}>Prev</Button>
              <span>Page {currentPage + 1}/{totalPages}</span>
              <Button variant="outline" size="sm" disabled={currentPage >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirm} onOpenChange={() => setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.activate ? 'Activate Rule' : 'Deactivate Rule'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.activate ? `Activate "${confirm?.setting.notificationCode}"?` : `Deactivate "${confirm?.setting.notificationCode}"?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runConfirm} className="bg-sky-600">Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
