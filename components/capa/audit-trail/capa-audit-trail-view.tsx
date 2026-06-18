'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, FileSpreadsheet, FileText, Lock, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  CAPA_AUDIT_ACTION_TYPES,
  CAPA_AUDIT_MODULES,
  applyCapaAuditFilters,
  canExportCapaAuditTrail,
  computeCapaAuditDashboard,
  exportCapaAuditCsv,
  formatAuditDateTimeLocal,
  getExportHistoryEntries,
  getFieldChangeEntries,
  getUserActivitySummary,
  isCapaAuditReadOnly,
  paginateCapaAuditEntries,
  type CapaAuditEntry,
  type CapaAuditFilters,
} from '@/lib/capa-audit-trail-records';
import {
  getFilteredCapaAuditTrail,
  logCapaAuditExport,
  logCapaAuditPreviewed,
  openCapaAuditPdfReport,
} from '@/lib/capa-audit-trail-service';
import { getCapaById } from '@/lib/capa-service';
import { downloadCsv } from '@/lib/export-utils';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { KpiCard } from '@/components/admin/dashboard/kpi-card';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { CapaAuditTimeline } from './capa-audit-timeline';
import { CapaAuditTable } from './capa-audit-table';
import { CapaAuditTrailAccessGuard } from './capa-audit-trail-access-guard';
import { CapaStatusBadge } from '@/components/capa/capa-sub-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CapaRecord } from '@/lib/capa-types';

const PAGE_SIZE = 20;

function FilterPanel({
  search, setSearch, capaNumber, setCapaNumber, actionFilter, setActionFilter,
  moduleFilter, setModuleFilter, departmentFilter, setDepartmentFilter,
  startDate, setStartDate, endDate, setEndDate, departments, canExport,
  onExportPdf, onExportExcel, onPageReset, showCapaNumber = true,
}: {
  search: string; setSearch: (v: string) => void;
  capaNumber: string; setCapaNumber: (v: string) => void;
  actionFilter: string; setActionFilter: (v: string) => void;
  moduleFilter: string; setModuleFilter: (v: string) => void;
  departmentFilter: string; setDepartmentFilter: (v: string) => void;
  startDate: string; setStartDate: (v: string) => void;
  endDate: string; setEndDate: (v: string) => void;
  departments: string[];
  canExport: boolean;
  onExportPdf: () => void;
  onExportExcel: () => void;
  onPageReset: () => void;
  showCapaNumber?: boolean;
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
        {showCapaNumber && (
          <div className="space-y-1">
            <Label>CAPA Number</Label>
            <Input placeholder="CAPA-..." value={capaNumber} onChange={(e) => { setCapaNumber(e.target.value); onPageReset(); }} />
          </div>
        )}
        <div className="space-y-1">
          <Label>Action Type</Label>
          <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); onPageReset(); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {CAPA_AUDIT_ACTION_TYPES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Module Name</Label>
          <Select value={moduleFilter} onValueChange={(v) => { setModuleFilter(v); onPageReset(); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Modules</SelectItem>
              {CAPA_AUDIT_MODULES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
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
  entries, paginatedItems, totalPages, compact,
}: {
  entries: CapaAuditEntry[];
  paginatedItems: CapaAuditEntry[];
  totalPages: number;
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
        <CapaAuditTimeline entries={paginatedItems} grouped />
      </TabsContent>
      <TabsContent value="table" className="mt-4">
        <CapaAuditTable entries={paginatedItems} compact={compact} />
      </TabsContent>
      <TabsContent value="fields" className="mt-4">
        {fieldChanges.length ? (
          <CapaAuditTable entries={fieldChanges} compact={compact} />
        ) : (
          <EmptyState title="No field changes" message="Field-level change history appears when values are updated." />
        )}
      </TabsContent>
      <TabsContent value="users" className="mt-4">
        {userActivities.length ? (
          <ResponsiveDataTable columns={userColumns} data={userActivities.map((u, i) => ({ id: String(i), ...u }))} mobileTitleKey="user" mobileSubtitleKey="role" pageSize={10} />
        ) : (
          <EmptyState title="No user activities" message="User action tracking will appear as CAPA activities are logged." />
        )}
      </TabsContent>
      <TabsContent value="exports" className="mt-4">
        {exportHistory.length ? (
          <CapaAuditTable entries={exportHistory} compact={compact} />
        ) : (
          <EmptyState title="No export history" message="Export activities are logged when PDF or Excel exports are performed." />
        )}
      </TabsContent>
    </Tabs>
  );
}

interface CapaAuditTrailViewProps {
  capaId: string;
  compact?: boolean;
  showHeader?: boolean;
}

export function CapaAuditTrailView({ capaId, compact, showHeader = true }: CapaAuditTrailViewProps) {
  const { user, profile } = useAuth();
  const role = profile?.role;
  const canExport = canExportCapaAuditTrail(role);
  const readOnly = isCapaAuditReadOnly(role);

  const [record, setRecord] = useState<CapaRecord | null>(null);
  const [allEntries, setAllEntries] = useState<CapaAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const previewLogged = useRef(false);

  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || 'System',
    role: role || '',
    department: profile?.department || '',
  }), [user?.uid, profile?.full_name, profile?.department, role]);

  const filters: CapaAuditFilters = useMemo(() => ({
    search, action_type: actionFilter, module_name: moduleFilter,
    department: departmentFilter, start_date: startDate, end_date: endDate,
  }), [search, actionFilter, moduleFilter, departmentFilter, startDate, endDate]);

  const load = useCallback(async () => {
    if (!capaId) {
      setError('CAPA ID is required');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const capa = await getCapaById(capaId);
      if (!capa) {
        setError('CAPA record not found');
        setRecord(null);
        setAllEntries([]);
        return;
      }
      setRecord(capa);
      const rows = await getFilteredCapaAuditTrail({
        capaId, capaNumber: capa.capa_number, role,
        userDepartment: profile?.department, userId: user?.uid,
      });
      setAllEntries(rows);
      setPage(1);
    } catch {
      setError('Failed to load audit trail.');
    } finally {
      setLoading(false);
    }
  }, [capaId, role, profile?.department, user?.uid]);

  useEffect(() => { void load(); }, [load]);

  const entries = useMemo(() => applyCapaAuditFilters(allEntries, filters), [allEntries, filters]);
  const dashboard = useMemo(() => computeCapaAuditDashboard(entries), [entries]);
  const paginated = useMemo(() => paginateCapaAuditEntries(entries, page, PAGE_SIZE), [entries, page]);
  const departments = useMemo(() => ['All', ...Array.from(new Set(allEntries.map((e) => e.department).filter(Boolean))).sort()], [allEntries]);

  useEffect(() => {
    if (record && !compact && !previewLogged.current) {
      previewLogged.current = true;
      void logCapaAuditPreviewed(actor, capaId, record.capa_number);
    }
  }, [record, compact, actor, capaId]);

  const handleExportPdf = async () => {
    if (!canExport) return toast.error('No export permission');
    if (!record) return;
    openCapaAuditPdfReport(entries, record.capa_number, actor.name, filters);
    await logCapaAuditExport(actor, capaId, record.capa_number, 'PDF', entries.length);
    toast.success('PDF export placeholder opened (audit logged)');
  };

  const handleExportExcel = async () => {
    if (!canExport) return toast.error('No export permission');
    if (!record) return;
    const { headers, rows } = exportCapaAuditCsv(entries);
    downloadCsv(`${record.capa_number}-audit-trail.csv`, headers, rows);
    await logCapaAuditExport(actor, capaId, record.capa_number, 'Excel', entries.length);
    toast.success('Excel export downloaded (audit logged)');
  };

  const content = (
    <div className="space-y-4">
      {showHeader && record && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono font-bold text-lg">{record.capa_number}</span>
          <CapaStatusBadge status={record.capa_status} />
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground border rounded-full px-2 py-0.5">
            <Lock className="h-3 w-3" /> Read-only · Immutable audit log
          </span>
        </div>
      )}

      {!compact && !loading && !error && entries.length > 0 && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
          <KpiCard label="Total Audit Logs" value={dashboard.total} />
          <KpiCard label="Today's Activities" value={dashboard.todayActivities} accent="border-l-blue-600" />
          <KpiCard label="Implementation" value={dashboard.implementationActivities} accent="border-l-purple-600" />
          <KpiCard label="Approval" value={dashboard.approvalActivities} accent="border-l-green-600" />
          <KpiCard label="Effectiveness" value={dashboard.effectivenessActivities} accent="border-l-teal-600" />
          <KpiCard label="Closure" value={dashboard.closureActivities} accent="border-l-slate-600" />
          <KpiCard label="Reopened CAPA" value={dashboard.reopenedCapa} accent="border-l-amber-600" />
          <KpiCard label="Export Activities" value={dashboard.exportActivities} accent="border-l-violet-600" />
        </div>
      )}

      <FilterPanel
        search={search} setSearch={setSearch} capaNumber="" setCapaNumber={() => {}}
        actionFilter={actionFilter} setActionFilter={setActionFilter}
        moduleFilter={moduleFilter} setModuleFilter={setModuleFilter}
        departmentFilter={departmentFilter} setDepartmentFilter={setDepartmentFilter}
        startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate}
        departments={departments} canExport={canExport}
        onExportPdf={() => void handleExportPdf()} onExportExcel={() => void handleExportExcel()}
        onPageReset={() => setPage(1)} showCapaNumber={false}
      />

      {loading ? <LoadingSkeleton rows={3} /> : error ? (
        <ErrorCard title="Load error" message={error} onRetry={load} />
      ) : !entries.length ? (
        <EmptyState title="No audit trail entries" message="No activity logged for this CAPA yet, or filters exclude all records." />
      ) : (
        <div className="space-y-3">
          <AuditTabsContent entries={entries} paginatedItems={paginated.items} totalPages={paginated.totalPages} compact={compact} />
          <PaginationBar page={paginated.page} totalPages={paginated.totalPages} total={entries.length}
            onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
        </div>
      )}

      {readOnly && <p className="text-xs text-muted-foreground text-center">Auditor access: read-only. No edit or delete permitted.</p>}
    </div>
  );

  if (compact) return content;

  return (
    <CapaAuditTrailAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="CAPA Audit Trail"
          description="Complete CAPA activity history and GMP audit trail"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/capa' },
            { label: 'CAPA Management', href: '/qms/capa' },
            { label: record?.capa_number || 'Audit Trail' },
          ]}
        />
        {content}
      </div>
    </CapaAuditTrailAccessGuard>
  );
}

export function CapaAuditTrailListPage() {
  const { user, profile } = useAuth();
  const role = profile?.role;
  const canExport = canExportCapaAuditTrail(role);
  const readOnly = isCapaAuditReadOnly(role);

  const [allEntries, setAllEntries] = useState<CapaAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState('');
  const [capaNumber, setCapaNumber] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || 'System',
    role: role || '',
    department: profile?.department || '',
  }), [user?.uid, profile?.full_name, profile?.department, role]);

  const filters: CapaAuditFilters = useMemo(() => ({
    search, capa_number: capaNumber, action_type: actionFilter, module_name: moduleFilter,
    department: departmentFilter, start_date: startDate, end_date: endDate,
  }), [search, capaNumber, actionFilter, moduleFilter, departmentFilter, startDate, endDate]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await getFilteredCapaAuditTrail({
        role, userDepartment: profile?.department, userId: user?.uid, filters: {},
      });
      setAllEntries(rows);
      setPage(1);
    } catch {
      setError('Failed to load CAPA audit trail.');
    } finally {
      setLoading(false);
    }
  }, [role, profile?.department, user?.uid]);

  useEffect(() => { void load(); }, [load]);

  const entries = useMemo(() => applyCapaAuditFilters(allEntries, filters), [allEntries, filters]);
  const dashboard = useMemo(() => computeCapaAuditDashboard(entries), [entries]);
  const paginated = useMemo(() => paginateCapaAuditEntries(entries, page, PAGE_SIZE), [entries, page]);
  const departments = useMemo(() => ['All', ...Array.from(new Set(allEntries.map((e) => e.department).filter(Boolean))).sort()], [allEntries]);

  const handleExportPdf = async () => {
    if (!canExport) return toast.error('No export permission');
    openCapaAuditPdfReport(entries, 'All CAPA', actor.name, filters);
    await logCapaAuditExport(actor, 'workspace', 'All CAPA', 'PDF', entries.length);
    toast.success('PDF export placeholder opened (audit logged)');
  };

  const handleExportExcel = async () => {
    if (!canExport) return toast.error('No export permission');
    const { headers, rows } = exportCapaAuditCsv(entries);
    downloadCsv(`capa-audit-trail-${Date.now()}.csv`, headers, rows);
    await logCapaAuditExport(actor, 'workspace', 'All CAPA', 'Excel', entries.length);
    toast.success('Excel export downloaded (audit logged)');
  };

  return (
    <CapaAuditTrailAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="CAPA Audit Trail"
          description="Complete CAPA activity history and GMP audit trail"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/capa' },
            { label: 'CAPA Management', href: '/qms/capa' },
            { label: 'Audit Trail' },
          ]}
        />

        {!loading && !error && (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
            <KpiCard label="Total Audit Logs" value={dashboard.total} />
            <KpiCard label="Today's Activities" value={dashboard.todayActivities} accent="border-l-blue-600" />
            <KpiCard label="Implementation" value={dashboard.implementationActivities} accent="border-l-purple-600" />
            <KpiCard label="Approval" value={dashboard.approvalActivities} accent="border-l-green-600" />
            <KpiCard label="Effectiveness" value={dashboard.effectivenessActivities} accent="border-l-teal-600" />
            <KpiCard label="Closure" value={dashboard.closureActivities} accent="border-l-slate-600" />
            <KpiCard label="Reopened CAPA" value={dashboard.reopenedCapa} accent="border-l-amber-600" />
            <KpiCard label="Export Activities" value={dashboard.exportActivities} accent="border-l-violet-600" />
          </div>
        )}

        <FilterPanel
          search={search} setSearch={setSearch} capaNumber={capaNumber} setCapaNumber={setCapaNumber}
          actionFilter={actionFilter} setActionFilter={setActionFilter}
          moduleFilter={moduleFilter} setModuleFilter={setModuleFilter}
          departmentFilter={departmentFilter} setDepartmentFilter={setDepartmentFilter}
          startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate}
          departments={departments} canExport={canExport}
          onExportPdf={() => void handleExportPdf()} onExportExcel={() => void handleExportExcel()}
          onPageReset={() => setPage(1)}
        />

        {loading ? <LoadingSkeleton rows={3} /> : error ? (
          <ErrorCard title="Load error" message={error} onRetry={load} />
        ) : entries.length ? (
          <div className="space-y-3">
            <AuditTabsContent entries={entries} paginatedItems={paginated.items} totalPages={paginated.totalPages} />
            <PaginationBar page={paginated.page} totalPages={paginated.totalPages} total={entries.length}
              onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
          </div>
        ) : (
          <EmptyState title="No audit entries" message="CAPA audit activity will appear here as actions are performed across the module." />
        )}

        {readOnly && <p className="text-xs text-muted-foreground text-center">Auditor access: read-only. No edit or delete permitted.</p>}
      </div>
    </CapaAuditTrailAccessGuard>
  );
}
