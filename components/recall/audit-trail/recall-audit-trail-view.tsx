'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, FileSpreadsheet, FileText, Lock, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  RECALL_AUDIT_ACTION_TYPES,
  RECALL_AUDIT_MODULES,
  applyRecallAuditFilters,
  canExportRecallAuditTrail,
  computeRecallAuditDashboard,
  exportRecallAuditCsv,
  formatAuditDateTimeLocal,
  getExportHistoryEntries,
  getFieldChangeEntries,
  getUserActivitySummary,
  isRecallAuditReadOnly,
  paginateRecallAuditEntries,
  type RecallAuditEntry,
  type RecallAuditFilters,
} from '@/lib/recall-audit-trail-records';
import {
  getFilteredRecallAuditTrail,
  logRecallAuditExport,
  logRecallAuditPreviewed,
  openRecallAuditPdfReport,
} from '@/lib/recall-audit-trail-service';
import { getRecallById } from '@/lib/recall-service';
import { downloadCsv } from '@/lib/export-utils';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { KpiCard } from '@/components/admin/dashboard/kpi-card';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { RecallAuditTimeline } from './recall-audit-timeline';
import { RecallAuditTable } from './recall-audit-table';
import { RecallAuditTrailAccessGuard } from './recall-audit-trail-access-guard';
import { RecallStatusBadge, ClassificationBadge } from '@/components/recall/recall-sub-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { RecallRecord } from '@/lib/recall-types';

const PAGE_SIZE = 20;

function FilterPanel({
  search, setSearch, recallNumber, setRecallNumber, actionFilter, setActionFilter,
  moduleFilter, setModuleFilter, userFilter, setUserFilter, departmentFilter, setDepartmentFilter,
  startDate, setStartDate, endDate, setEndDate, departments, users, canExport,
  onExportPdf, onExportExcel, onPageReset, showRecallNumber = true,
}: {
  search: string; setSearch: (v: string) => void;
  recallNumber: string; setRecallNumber: (v: string) => void;
  actionFilter: string; setActionFilter: (v: string) => void;
  moduleFilter: string; setModuleFilter: (v: string) => void;
  userFilter: string; setUserFilter: (v: string) => void;
  departmentFilter: string; setDepartmentFilter: (v: string) => void;
  startDate: string; setStartDate: (v: string) => void;
  endDate: string; setEndDate: (v: string) => void;
  departments: string[];
  users: { id: string; name: string }[];
  canExport: boolean;
  onExportPdf: () => void;
  onExportExcel: () => void;
  onPageReset: () => void;
  showRecallNumber?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Filter Panel</CardTitle>
        <CardDescription>Search and filter audit logs. Records are immutable — no edit or delete.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1 sm:col-span-2 lg:col-span-3">
          <Label>Search</Label>
          <div className="relative max-w-lg">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Actions, users, fields, values..." value={search}
              onChange={(e) => { setSearch(e.target.value); onPageReset(); }} />
          </div>
        </div>
        {showRecallNumber && (
          <div className="space-y-1">
            <Label>Recall Number</Label>
            <Input placeholder="REC/..." value={recallNumber} onChange={(e) => { setRecallNumber(e.target.value); onPageReset(); }} />
          </div>
        )}
        <div className="space-y-1">
          <Label>Action Type</Label>
          <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); onPageReset(); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {RECALL_AUDIT_ACTION_TYPES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Module Name</Label>
          <Select value={moduleFilter} onValueChange={(v) => { setModuleFilter(v); onPageReset(); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Modules</SelectItem>
              {RECALL_AUDIT_MODULES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>User</Label>
          <Select value={userFilter} onValueChange={(v) => { setUserFilter(v); onPageReset(); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Department</Label>
          <Select value={departmentFilter} onValueChange={(v) => { setDepartmentFilter(v); onPageReset(); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {departments.map((d) => <SelectItem key={d} value={d === 'All' ? 'all' : d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>From Date</Label>
          <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); onPageReset(); }} />
        </div>
        <div className="space-y-1">
          <Label>To Date</Label>
          <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); onPageReset(); }} />
        </div>
        {canExport && (
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
            <Button variant="outline" size="sm" onClick={onExportPdf}><FileText className="mr-1 h-4 w-4" />Export PDF</Button>
            <Button variant="outline" size="sm" onClick={onExportExcel}><FileSpreadsheet className="mr-1 h-4 w-4" />Export Excel</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PaginationBar({ page, totalPages, total, onPrev, onNext }: {
  page: number; totalPages: number; total: number; onPrev: () => void; onNext: () => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={onPrev}><ChevronLeft className="h-4 w-4" /></Button>
      <span className="text-xs text-muted-foreground">Page {page} of {totalPages} · {total} total</span>
      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={onNext}><ChevronRight className="h-4 w-4" /></Button>
    </div>
  );
}

function AuditTabsContent({
  entries, paginatedItems, compact,
}: {
  entries: RecallAuditEntry[];
  paginatedItems: RecallAuditEntry[];
  compact?: boolean;
}) {
  const fieldChanges = useMemo(() => getFieldChangeEntries(entries), [entries]);
  const userActivities = useMemo(() => getUserActivitySummary(entries), [entries]);
  const exportHistory = useMemo(() => getExportHistoryEntries(entries), [entries]);

  const userColumns = [
    { key: 'user', header: 'User', render: (r: { user: string }) => r.user },
    { key: 'role', header: 'Role', render: (r: { role: string }) => r.role || '—' },
    { key: 'count', header: 'Actions', render: (r: { count: number }) => r.count },
    { key: 'last', header: 'Last Activity', render: (r: { lastActivity: string }) => formatAuditDateTimeLocal(r.lastActivity) },
  ];

  return (
    <Tabs defaultValue="timeline">
      <TabsList className="flex h-auto flex-wrap gap-1">
        <TabsTrigger value="timeline">Timeline View</TabsTrigger>
        <TabsTrigger value="table">Audit Table</TabsTrigger>
        <TabsTrigger value="fields">Field Changes ({fieldChanges.length})</TabsTrigger>
        <TabsTrigger value="users">User Activities ({userActivities.length})</TabsTrigger>
        <TabsTrigger value="exports">Export History ({exportHistory.length})</TabsTrigger>
      </TabsList>
      <TabsContent value="timeline" className="mt-4">
        <RecallAuditTimeline entries={paginatedItems} grouped />
      </TabsContent>
      <TabsContent value="table" className="mt-4">
        <RecallAuditTable entries={paginatedItems} compact={compact} />
      </TabsContent>
      <TabsContent value="fields" className="mt-4">
        {fieldChanges.length ? (
          <RecallAuditTable entries={fieldChanges} compact={compact} />
        ) : (
          <EmptyState title="No field changes" message="Field-level change history appears when values are updated." />
        )}
      </TabsContent>
      <TabsContent value="users" className="mt-4">
        {userActivities.length ? (
          <ResponsiveDataTable columns={userColumns} data={userActivities.map((u, i) => ({ id: String(i), ...u }))} mobileTitleKey="user" mobileSubtitleKey="role" pageSize={10} />
        ) : (
          <EmptyState title="No user activities" message="User action tracking will appear as recall activities are logged." />
        )}
      </TabsContent>
      <TabsContent value="exports" className="mt-4">
        {exportHistory.length ? (
          <RecallAuditTable entries={exportHistory} compact={compact} />
        ) : (
          <EmptyState title="No export history" message="Export activities are logged when PDF or Excel exports are performed." />
        )}
      </TabsContent>
    </Tabs>
  );
}

interface RecallAuditTrailViewProps {
  recallId: string;
  compact?: boolean;
  showHeader?: boolean;
}

export function RecallAuditTrailView({ recallId, compact, showHeader = true }: RecallAuditTrailViewProps) {
  const { user, profile } = useAuth();
  const role = profile?.role;
  const canExport = canExportRecallAuditTrail(role);
  const readOnly = isRecallAuditReadOnly(role);

  const [record, setRecord] = useState<RecallRecord | null>(null);
  const [allEntries, setAllEntries] = useState<RecallAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const previewLogged = useRef(false);

  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || 'System',
    role: role || '',
    department: profile?.department || '',
  }), [user?.uid, profile?.full_name, profile?.department, role]);

  const filters: RecallAuditFilters = useMemo(() => ({
    search, action_type: actionFilter, module_name: moduleFilter,
    user_id: userFilter, department: departmentFilter, start_date: startDate, end_date: endDate,
  }), [search, actionFilter, moduleFilter, userFilter, departmentFilter, startDate, endDate]);

  const load = useCallback(async () => {
    if (!recallId) {
      setError('Recall ID is required');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const recall = await getRecallById(recallId);
      if (!recall) {
        setError('Recall not found');
        setRecord(null);
        setAllEntries([]);
        return;
      }
      setRecord(recall);
      const rows = await getFilteredRecallAuditTrail({
        recallId,
        recallNumber: recall.recall_number,
        role,
        userDepartment: profile?.department,
        userId: user?.uid,
      });
      setAllEntries(rows);
      setPage(1);
    } catch {
      setError('Failed to load audit trail.');
    } finally {
      setLoading(false);
    }
  }, [recallId, role, profile?.department, user?.uid]);

  useEffect(() => { void load(); }, [load]);

  const entries = useMemo(() => applyRecallAuditFilters(allEntries, filters), [allEntries, filters]);
  const dashboard = useMemo(() => computeRecallAuditDashboard(entries), [entries]);
  const paginated = useMemo(() => paginateRecallAuditEntries(entries, page, PAGE_SIZE), [entries, page]);
  const departments = useMemo(() => ['All', ...Array.from(new Set(allEntries.map((e) => e.department).filter(Boolean))).sort()], [allEntries]);
  const users = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of allEntries) {
      if (e.changed_by) map.set(e.changed_by, e.changed_by_name);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allEntries]);

  useEffect(() => {
    if (record && !compact && !previewLogged.current) {
      previewLogged.current = true;
      void logRecallAuditPreviewed(actor, recallId, record.recall_number);
    }
  }, [record, compact, actor, recallId]);

  const handleExportPdf = async () => {
    if (!canExport) return toast.error('No export permission');
    if (!record) return;
    openRecallAuditPdfReport(entries, record.recall_number, actor.name, filters);
    await logRecallAuditExport(actor, recallId, record.recall_number, 'PDF', entries.length);
    toast.success('PDF export placeholder opened (audit logged)');
  };

  const handleExportExcel = async () => {
    if (!canExport) return toast.error('No export permission');
    if (!record) return;
    const { headers, rows } = exportRecallAuditCsv(entries);
    downloadCsv(`${record.recall_number}-audit-trail.csv`, headers, rows);
    await logRecallAuditExport(actor, recallId, record.recall_number, 'Excel', entries.length);
    toast.success('Excel export downloaded (audit logged)');
  };

  const content = (
    <div className="space-y-4">
      {showHeader && record && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono font-bold text-lg">{record.recall_number}</span>
          <RecallStatusBadge status={record.recall_status} />
          <ClassificationBadge value={record.recall_classification} />
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground border rounded-full px-2 py-0.5">
            <Lock className="h-3 w-3" /> Read-only · Immutable audit log
          </span>
          <Link href={`/qms/recall/${recallId}`} className="text-xs text-blue-600 hover:underline ml-auto">View Recall</Link>
        </div>
      )}

      {!compact && !loading && !error && entries.length > 0 && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
          <KpiCard label="Total Audit Logs" value={dashboard.total} />
          <KpiCard label="Today's Activities" value={dashboard.todayActivities} accent="border-l-blue-600" />
          <KpiCard label="Recovery Activities" value={dashboard.recoveryActivities} accent="border-l-purple-600" />
          <KpiCard label="Regulatory Activities" value={dashboard.regulatoryActivities} accent="border-l-orange-600" />
          <KpiCard label="CAPA Activities" value={dashboard.capaActivities} accent="border-l-amber-600" />
          <KpiCard label="Closure Activities" value={dashboard.closureActivities} accent="border-l-slate-600" />
          <KpiCard label="Reopened Recalls" value={dashboard.reopenedRecalls} accent="border-l-amber-600" />
          <KpiCard label="Export Activities" value={dashboard.exportActivities} accent="border-l-violet-600" />
        </div>
      )}

      <FilterPanel
        search={search} setSearch={setSearch} recallNumber="" setRecallNumber={() => {}}
        actionFilter={actionFilter} setActionFilter={setActionFilter}
        moduleFilter={moduleFilter} setModuleFilter={setModuleFilter}
        userFilter={userFilter} setUserFilter={setUserFilter}
        departmentFilter={departmentFilter} setDepartmentFilter={setDepartmentFilter}
        startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate}
        departments={departments} users={users} canExport={canExport}
        onExportPdf={() => void handleExportPdf()} onExportExcel={() => void handleExportExcel()}
        onPageReset={() => setPage(1)} showRecallNumber={false}
      />

      {loading ? <LoadingSkeleton rows={3} /> : error ? (
        <ErrorCard title="Load error" message={error} onRetry={load} />
      ) : !entries.length ? (
        <EmptyState title="No audit trail entries" message="No activity logged for this recall yet, or filters exclude all records." />
      ) : (
        <div className="space-y-3">
          <AuditTabsContent entries={entries} paginatedItems={paginated.items} compact={compact} />
          <PaginationBar page={paginated.page} totalPages={paginated.totalPages} total={entries.length}
            onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
        </div>
      )}

      {readOnly && <p className="text-xs text-muted-foreground text-center">Auditor access: read-only. Export not permitted.</p>}
    </div>
  );

  if (compact) return content;

  return (
    <RecallAuditTrailAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Recall Audit Trail"
          description="Complete recall activity history and GMP audit trail"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/recall' },
            { label: 'Product Recall', href: '/qms/recall' },
            { label: record?.recall_number || 'Audit Trail' },
          ]}
        />
        {content}
      </div>
    </RecallAuditTrailAccessGuard>
  );
}

export function RecallAuditTrailListPage() {
  const { user, profile } = useAuth();
  const role = profile?.role;
  const canExport = canExportRecallAuditTrail(role);
  const readOnly = isRecallAuditReadOnly(role);

  const [allEntries, setAllEntries] = useState<RecallAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState('');
  const [recallNumber, setRecallNumber] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || 'System',
    role: role || '',
    department: profile?.department || '',
  }), [user?.uid, profile?.full_name, profile?.department, role]);

  const filters: RecallAuditFilters = useMemo(() => ({
    search, recall_number: recallNumber, action_type: actionFilter, module_name: moduleFilter,
    user_id: userFilter, department: departmentFilter, start_date: startDate, end_date: endDate,
  }), [search, recallNumber, actionFilter, moduleFilter, userFilter, departmentFilter, startDate, endDate]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await getFilteredRecallAuditTrail({
        role, userDepartment: profile?.department, userId: user?.uid, filters: {},
      });
      setAllEntries(rows);
      setPage(1);
    } catch {
      setError('Failed to load recall audit trail.');
    } finally {
      setLoading(false);
    }
  }, [role, profile?.department, user?.uid]);

  useEffect(() => { void load(); }, [load]);

  const entries = useMemo(() => applyRecallAuditFilters(allEntries, filters), [allEntries, filters]);
  const dashboard = useMemo(() => computeRecallAuditDashboard(entries), [entries]);
  const paginated = useMemo(() => paginateRecallAuditEntries(entries, page, PAGE_SIZE), [entries, page]);
  const departments = useMemo(() => ['All', ...Array.from(new Set(allEntries.map((e) => e.department).filter(Boolean))).sort()], [allEntries]);
  const users = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of allEntries) {
      if (e.changed_by) map.set(e.changed_by, e.changed_by_name);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allEntries]);

  const handleExportPdf = async () => {
    if (!canExport) return toast.error('No export permission');
    openRecallAuditPdfReport(entries, 'All Recalls', actor.name, filters);
    await logRecallAuditExport(actor, 'workspace', 'All Recalls', 'PDF', entries.length);
    toast.success('PDF export placeholder opened (audit logged)');
  };

  const handleExportExcel = async () => {
    if (!canExport) return toast.error('No export permission');
    const { headers, rows } = exportRecallAuditCsv(entries);
    downloadCsv(`recall-audit-trail-${Date.now()}.csv`, headers, rows);
    await logRecallAuditExport(actor, 'workspace', 'All Recalls', 'Excel', entries.length);
    toast.success('Excel export downloaded (audit logged)');
  };

  return (
    <RecallAuditTrailAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Recall Audit Trail"
          description="Complete recall activity history and GMP audit trail"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/recall' },
            { label: 'Product Recall', href: '/qms/recall' },
            { label: 'Audit Trail' },
          ]}
        />

        {!loading && !error && (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
            <KpiCard label="Total Audit Logs" value={dashboard.total} />
            <KpiCard label="Today's Activities" value={dashboard.todayActivities} accent="border-l-blue-600" />
            <KpiCard label="Recovery Activities" value={dashboard.recoveryActivities} accent="border-l-purple-600" />
            <KpiCard label="Regulatory Activities" value={dashboard.regulatoryActivities} accent="border-l-orange-600" />
            <KpiCard label="CAPA Activities" value={dashboard.capaActivities} accent="border-l-amber-600" />
            <KpiCard label="Closure Activities" value={dashboard.closureActivities} accent="border-l-slate-600" />
            <KpiCard label="Reopened Recalls" value={dashboard.reopenedRecalls} accent="border-l-amber-600" />
            <KpiCard label="Export Activities" value={dashboard.exportActivities} accent="border-l-violet-600" />
          </div>
        )}

        <FilterPanel
          search={search} setSearch={setSearch} recallNumber={recallNumber} setRecallNumber={setRecallNumber}
          actionFilter={actionFilter} setActionFilter={setActionFilter}
          moduleFilter={moduleFilter} setModuleFilter={setModuleFilter}
          userFilter={userFilter} setUserFilter={setUserFilter}
          departmentFilter={departmentFilter} setDepartmentFilter={setDepartmentFilter}
          startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate}
          departments={departments} users={users} canExport={canExport}
          onExportPdf={() => void handleExportPdf()} onExportExcel={() => void handleExportExcel()}
          onPageReset={() => setPage(1)}
        />

        {loading ? <LoadingSkeleton rows={3} /> : error ? (
          <ErrorCard title="Load error" message={error} onRetry={load} />
        ) : entries.length ? (
          <div className="space-y-3">
            <AuditTabsContent entries={entries} paginatedItems={paginated.items} />
            <PaginationBar page={paginated.page} totalPages={paginated.totalPages} total={entries.length}
              onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
          </div>
        ) : (
          <EmptyState title="No audit entries" message="Recall audit activity will appear here as actions are performed across the module." />
        )}

        {readOnly && <p className="text-xs text-muted-foreground text-center">Auditor access: read-only. Export not permitted.</p>}
      </div>
    </RecallAuditTrailAccessGuard>
  );
}
