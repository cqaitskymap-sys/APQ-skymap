'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Download, Eye, Printer, FileSpreadsheet, Shield, User, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { KpiCard } from '@/components/admin/dashboard/kpi-card';
import { StatusBadge } from '@/components/admin/dashboard/status-badge';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ModuleBadge } from '@/components/admin/workflows/module-badge';
import { ActionTypeBadge } from './action-type-badge';
import { AuditTrailCharts } from './audit-trail-charts';
import { AuditTimeline } from './audit-timeline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/auth-context';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canExportAuditTrail } from '@/lib/permissions';
import {
  AUDIT_TRAIL_MODULES, AUDIT_ACTION_TYPES, AUDIT_LOG_STATUSES,
} from '@/lib/admin/constants';
import type { AuditTrailEntry } from '@/lib/admin/schemas';
import {
  fetchAuditTrailEntries, filterAuditTrailByRole, applyAuditTrailFilters,
  getAuditTrailSummary, getAuditChartsData, getUserActivityTimeline,
  exportAuditTrailExcel, openAuditTrailPdfReport, logAuditTrailExport,
  type AuditTrailFilters,
} from '@/lib/admin/audit-trail-service';
import { fetchDepartments } from '@/lib/admin/department-service';

const PAGE_SIZE = 15;

export function AuditTrailListPage() {
  const { user, profile } = useAuth();
  const { role } = useAdminPermissions();
  const canExport = canExportAuditTrail(role);

  const [entries, setEntries] = useState<AuditTrailEntry[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [recordIdFilter, setRecordIdFilter] = useState('');
  const [docNumberFilter, setDocNumberFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [timelineUserId, setTimelineUserId] = useState('');
  const [page, setPage] = useState(0);

  const auditMeta = {
    userId: user?.uid || 'system',
    userName: profile?.full_name || profile?.email || 'Admin',
    role,
    department: profile?.department || '',
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, depts] = await Promise.all([
        fetchAuditTrailEntries(),
        fetchDepartments(),
      ]);
      const scoped = filterAuditTrailByRole(list, role, user?.uid);
      setEntries(scoped);
      setDepartments(
        [...new Set(depts.map((d) => d.departmentName.trim()).filter(Boolean))].sort((a, b) =>
          a.localeCompare(b),
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [role, user?.uid]);

  useEffect(() => { load(); }, [load]);

  const filters: AuditTrailFilters = useMemo(() => ({
    search,
    moduleName: moduleFilter,
    actionType: actionFilter,
    status: statusFilter,
    userId: userFilter,
    department: deptFilter,
    recordId: recordIdFilter,
    documentNumber: docNumberFilter,
    startDate,
    endDate,
  }), [search, moduleFilter, actionFilter, statusFilter, userFilter, deptFilter, recordIdFilter, docNumberFilter, startDate, endDate]);

  const filtered = useMemo(() => applyAuditTrailFilters(entries, filters), [entries, filters]);
  const stats = getAuditTrailSummary(filtered);
  const charts = getAuditChartsData(filtered);

  const users = useMemo(() => {
    const map = new Map<string, string>();
    entries.forEach((e) => {
      if (e.changedByUserId) map.set(e.changedByUserId, e.changedByUserName);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [entries]);

  const userTimeline = timelineUserId
    ? getUserActivityTimeline(filtered, timelineUserId)
    : [];

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginated = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const handleExcelExport = async () => {
    const csv = exportAuditTrailExcel(filtered);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-trail-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    await logAuditTrailExport(auditMeta, 'Excel', filtered.length);
    toast.success('Audit trail exported (Excel-compatible CSV)');
  };

  const handlePdfExport = async () => {
    openAuditTrailPdfReport(filtered, filters, auditMeta.userName);
    await logAuditTrailExport(auditMeta, 'PDF', filtered.length);
    toast.success('PDF report opened — use Print to save');
  };

  const handlePrint = async () => {
    openAuditTrailPdfReport(filtered, filters, auditMeta.userName);
    await logAuditTrailExport(auditMeta, 'Print', filtered.length);
  };

  if (loading) return <div><PageHeader title="Audit Trail" basePath="/admin" /><LoadingSkeleton rows={3} /></div>;
  if (error) return <ErrorCard message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Trail"
        description="GMP & 21 CFR Part 11 compliant immutable audit log"
        basePath="/admin"
        actions={
          canExport ? (
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={handleExcelExport}>
                <FileSpreadsheet className="h-4 w-4 mr-1" />Export Excel
              </Button>
              <Button variant="outline" size="sm" onClick={handlePdfExport}>
                <Download className="h-4 w-4 mr-1" />Export PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-1" />Print
              </Button>
            </div>
          ) : undefined
        }
      />

      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="p-4 flex items-center gap-3">
          <Shield className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-900">
            Audit trail records are append-only, tamper-proof, and read-only. No edit or delete actions are available.
            Firestore rules block client-side update/delete on <code className="text-xs">audit_trail</code>.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <KpiCard label="Total Logs" value={stats.total} />
        <KpiCard label="Today" value={stats.todayActivities} />
        <KpiCard label="Critical" value={stats.criticalActions} />
        <KpiCard label="Failed Logins" value={stats.failedLogins} />
        <KpiCard label="Approvals" value={stats.approvalActions} />
        <KpiCard label="Rejected" value={stats.rejectedActions} />
        <KpiCard label="Exports" value={stats.exportActions} />
        <KpiCard label="Setting Changes" value={stats.systemSettingChanges} />
      </div>

      <AuditTrailCharts {...charts} />

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list"><FileText className="h-4 w-4 mr-1" />List</TabsTrigger>
          <TabsTrigger value="user-timeline"><User className="h-4 w-4 mr-1" />User Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="relative lg:col-span-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search user, module, record, document number, action..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                    className="pl-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Module</Label>
                  <Select value={moduleFilter} onValueChange={(v) => { setModuleFilter(v); setPage(0); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Modules</SelectItem>
                      {AUDIT_TRAIL_MODULES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Action</Label>
                  <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Actions</SelectItem>
                      {AUDIT_ACTION_TYPES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">User</Label>
                  <Select value={userFilter} onValueChange={(v) => { setUserFilter(v); setPage(0); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Department</Label>
                  <Select value={deptFilter} onValueChange={(v) => { setDeptFilter(v); setPage(0); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      {AUDIT_LOG_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Record ID</Label>
                  <Input value={recordIdFilter} onChange={(e) => { setRecordIdFilter(e.target.value); setPage(0); }} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Document Number</Label>
                  <Input value={docNumberFilter} onChange={(e) => { setDocNumberFilter(e.target.value); setPage(0); }} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Start Date</Label>
                  <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(0); }} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">End Date</Label>
                  <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(0); }} />
                </div>
              </div>

              <div className="hidden md:block overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Date Time</TableHead>
                      <TableHead>Module</TableHead>
                      <TableHead>Record</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">View</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7}><EmptyState title="No audit records found" /></TableCell>
                      </TableRow>
                    ) : (
                      paginated.map((row) => (
                        <TableRow key={row.id || row.auditId}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {new Date(row.dateTime).toLocaleString()}
                          </TableCell>
                          <TableCell><ModuleBadge module={row.moduleName} /></TableCell>
                          <TableCell className="font-mono text-xs max-w-[120px] truncate">{row.recordId}</TableCell>
                          <TableCell><ActionTypeBadge action={row.actionType} /></TableCell>
                          <TableCell className="text-sm">{row.changedByUserName}</TableCell>
                          <TableCell><StatusBadge status={row.status} /></TableCell>
                          <TableCell className="text-right">
                            {row.id && (
                              <Button asChild variant="ghost" size="icon">
                                <Link href={`/admin/audit-trail/${row.id}`}><Eye className="h-4 w-4" /></Link>
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="md:hidden space-y-3">
                {paginated.map((row) => (
                  <Card key={row.id || row.auditId} className="border">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <ActionTypeBadge action={row.actionType} />
                        <StatusBadge status={row.status} />
                      </div>
                      <p className="text-xs text-muted-foreground">{new Date(row.dateTime).toLocaleString()}</p>
                      <div className="flex flex-wrap gap-2">
                        <ModuleBadge module={row.moduleName} />
                      </div>
                      <p className="text-sm">{row.changedByUserName}</p>
                      <p className="font-mono text-xs text-muted-foreground">{row.recordId}</p>
                      {row.id && (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/admin/audit-trail/${row.id}`}>View Details</Link>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{filtered.length} audit records</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setPage((p) => p - 1)}>Prev</Button>
                  <span>Page {currentPage + 1}/{totalPages}</span>
                  <Button variant="outline" size="sm" disabled={currentPage >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="user-timeline" className="mt-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-1 max-w-md">
                <Label>Select user for activity timeline</Label>
                <Select value={timelineUserId || 'none'} onValueChange={(v) => setTimelineUserId(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select user...</SelectItem>
                    {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <AuditTimeline
                entries={userTimeline.slice(0, 50)}
                title={timelineUserId ? `Activity for ${users.find((u) => u.id === timelineUserId)?.name}` : undefined}
                emptyMessage="Select a user to view activity timeline"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
