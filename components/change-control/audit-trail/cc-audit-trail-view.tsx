'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, FileSpreadsheet, FileText, Lock, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  CC_AUDIT_ACTION_TYPES,
  CC_AUDIT_MODULES,
  applyCcAuditFilters,
  canExportCcAuditTrail,
  computeCcAuditDashboard,
  exportCcAuditCsv,
  formatAuditDateTimeLocal,
  getExportHistoryEntries,
  getFieldChangeEntries,
  getUserActivitySummary,
  getValidationActivityEntries,
  isCcAuditReadOnly,
  getUniqueAuditUsers,
  paginateCcAuditEntries,
  sortCcAuditEntriesDesc,
  type CcAuditEntry,
  type CcAuditFilters,
} from '@/lib/cc-audit-trail-records';
import {
  getFilteredCcAuditTrail,
  logCcAuditExport,
  logCcAuditPreviewed,
  openCcAuditPdfReport,
} from '@/lib/cc-audit-trail-service';
import { getChangeById, listChanges } from '@/lib/change-control-service';
import { downloadCsv } from '@/lib/export-utils';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { KpiCard } from '@/components/admin/dashboard/kpi-card';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { CcAuditTimeline } from './cc-audit-timeline';
import { CcAuditTable } from './cc-audit-table';
import { CcAuditTrailAccessGuard } from './cc-audit-trail-access-guard';
import { CcStatusBadge } from '@/components/change-control/cc-sub-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import type { ChangeControlRecord } from '@/lib/change-control-types';

const PAGE_SIZE = 20;

function FilterPanel({
  search, setSearch, changeNumber, setChangeNumber, actionFilter, setActionFilter,
  moduleFilter, setModuleFilter, userFilter, setUserFilter, departmentFilter, setDepartmentFilter,
  startDate, setStartDate, endDate, setEndDate, departments, users, canExport,
  validationImpactOnly, setValidationImpactOnly, csvImpactOnly, setCsvImpactOnly,
  criticalOnly, setCriticalOnly,
  onExportPdf, onExportExcel, onPageReset, showChangeNumber = true,
}: {
  search: string; setSearch: (v: string) => void;
  changeNumber: string; setChangeNumber: (v: string) => void;
  actionFilter: string; setActionFilter: (v: string) => void;
  moduleFilter: string; setModuleFilter: (v: string) => void;
  userFilter: string; setUserFilter: (v: string) => void;
  departmentFilter: string; setDepartmentFilter: (v: string) => void;
  startDate: string; setStartDate: (v: string) => void;
  endDate: string; setEndDate: (v: string) => void;
  departments: string[];
  users: { id: string; name: string }[];
  canExport: boolean;
  validationImpactOnly: boolean; setValidationImpactOnly: (v: boolean) => void;
  csvImpactOnly: boolean; setCsvImpactOnly: (v: boolean) => void;
  criticalOnly: boolean; setCriticalOnly: (v: boolean) => void;
  onExportPdf: () => void;
  onExportExcel: () => void;
  onPageReset: () => void;
  showChangeNumber?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Filter Panel</CardTitle>
        <CardDescription>Search and filter audit logs. Records are immutable — no edit or delete (Annex 11).</CardDescription>
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
        {showChangeNumber && (
          <div className="space-y-1">
            <Label>Change Number</Label>
            <Input placeholder="CC-..." value={changeNumber} onChange={(e) => { setChangeNumber(e.target.value); onPageReset(); }} />
          </div>
        )}
        <div className="space-y-1">
          <Label>Action Type</Label>
          <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); onPageReset(); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {CC_AUDIT_ACTION_TYPES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Module Name</Label>
          <Select value={moduleFilter} onValueChange={(v) => { setModuleFilter(v); onPageReset(); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Modules</SelectItem>
              {CC_AUDIT_MODULES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
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
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={validationImpactOnly} onCheckedChange={(v) => { setValidationImpactOnly(Boolean(v)); onPageReset(); }} />
            Validation Impact
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={csvImpactOnly} onCheckedChange={(v) => { setCsvImpactOnly(Boolean(v)); onPageReset(); }} />
            CSV Impact
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={criticalOnly} onCheckedChange={(v) => { setCriticalOnly(Boolean(v)); onPageReset(); }} />
            Critical Changes Only
          </label>
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
  entries, paginatedItems, tablePage, tableTotalPages, tableTotal, onTablePrev, onTableNext, compact,
}: {
  entries: CcAuditEntry[];
  paginatedItems: CcAuditEntry[];
  tablePage: number;
  tableTotalPages: number;
  tableTotal: number;
  onTablePrev: () => void;
  onTableNext: () => void;
  compact?: boolean;
}) {
  const fieldChanges = useMemo(() => getFieldChangeEntries(entries), [entries]);
  const userActivities = useMemo(() => getUserActivitySummary(entries), [entries]);
  const validationActivities = useMemo(() => getValidationActivityEntries(entries), [entries]);
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
        <TabsTrigger value="validation">Validation Activities ({validationActivities.length})</TabsTrigger>
        <TabsTrigger value="exports">Export History ({exportHistory.length})</TabsTrigger>
      </TabsList>
      <TabsContent value="timeline" className="mt-4">
        <CcAuditTimeline entries={entries} grouped />
      </TabsContent>
      <TabsContent value="table" className="mt-4 space-y-3">
        <CcAuditTable entries={paginatedItems} compact={compact} />
        {tableTotalPages > 1 ? (
          <PaginationBar page={tablePage} totalPages={tableTotalPages} total={tableTotal}
            onPrev={onTablePrev} onNext={onTableNext} />
        ) : null}
      </TabsContent>
      <TabsContent value="fields" className="mt-4">
        {fieldChanges.length ? (
          <CcAuditTable entries={fieldChanges} compact={compact} />
        ) : (
          <EmptyState title="No field changes" message="Field-level change history appears when values are updated." />
        )}
      </TabsContent>
      <TabsContent value="users" className="mt-4">
        {userActivities.length ? (
          <ResponsiveDataTable columns={userColumns} data={userActivities.map((u, i) => ({ id: String(i), ...u }))} mobileTitleKey="user" mobileSubtitleKey="role" pageSize={10} />
        ) : (
          <EmptyState title="No user activities" message="User action tracking will appear as change control activities are logged." />
        )}
      </TabsContent>
      <TabsContent value="validation" className="mt-4">
        {validationActivities.length ? (
          <CcAuditTable entries={validationActivities} compact={compact} />
        ) : (
          <EmptyState title="No validation activities" message="Validation assessment and CSV-related audit entries will appear here." />
        )}
      </TabsContent>
      <TabsContent value="exports" className="mt-4">
        {exportHistory.length ? (
          <CcAuditTable entries={exportHistory} compact={compact} />
        ) : (
          <EmptyState title="No export history" message="Export activities are logged when PDF or Excel exports are performed." />
        )}
      </TabsContent>
    </Tabs>
  );
}

interface CcAuditTrailViewProps {
  changeId: string;
  compact?: boolean;
  showHeader?: boolean;
}

export function CcAuditTrailView({ changeId, compact, showHeader = true }: CcAuditTrailViewProps) {
  const { user, profile } = useAuth();
  const role = profile?.role;
  const canExport = canExportCcAuditTrail(role);
  const readOnly = isCcAuditReadOnly(role);

  const [record, setRecord] = useState<ChangeControlRecord | null>(null);
  const [allEntries, setAllEntries] = useState<CcAuditEntry[]>([]);
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
  const [validationImpactOnly, setValidationImpactOnly] = useState(false);
  const [csvImpactOnly, setCsvImpactOnly] = useState(false);
  const [criticalOnly, setCriticalOnly] = useState(false);

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || 'System',
    role: role || '',
    department: profile?.department || '',
  }), [user?.uid, profile?.full_name, profile?.department, role]);

  const filters: CcAuditFilters = useMemo(() => ({
    search, action_type: actionFilter, module_name: moduleFilter, user_id: userFilter,
    department: departmentFilter, start_date: startDate, end_date: endDate,
    validation_impact_only: validationImpactOnly, csv_impact_only: csvImpactOnly,
    critical_only: criticalOnly,
  }), [search, actionFilter, moduleFilter, userFilter, departmentFilter, startDate, endDate, validationImpactOnly, csvImpactOnly, criticalOnly]);

  const load = useCallback(async () => {
    if (!changeId) {
      setError('Change Control ID is required');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const change = await getChangeById(changeId);
      if (!change) {
        setError('Change control record not found');
        setRecord(null);
        setAllEntries([]);
        return;
      }
      setRecord(change);
      const rows = await getFilteredCcAuditTrail({
        changeId, changeNumber: change.change_control_number, role,
        userDepartment: profile?.department, userId: user?.uid, filters: {},
      });
      setAllEntries(rows);
      setPage(1);
    } catch {
      setError('Failed to load audit trail.');
    } finally {
      setLoading(false);
    }
  }, [changeId, role, profile?.department, user?.uid]);

  useEffect(() => { void load(); }, [load]);

  const entries = useMemo(() => {
    let filtered = applyCcAuditFilters(allEntries, filters);
    if (criticalOnly && record && record.change_category !== 'Critical') return [];
    return sortCcAuditEntriesDesc(filtered);
  }, [allEntries, filters, criticalOnly, record]);
  const dashboard = useMemo(() => computeCcAuditDashboard(entries), [entries]);
  const paginated = useMemo(() => paginateCcAuditEntries(entries, page, PAGE_SIZE), [entries, page]);
  const departments = useMemo(() => ['All', ...Array.from(new Set(allEntries.map((e) => e.department).filter(Boolean))).sort()], [allEntries]);
  const users = useMemo(() => getUniqueAuditUsers(allEntries), [allEntries]);

  useEffect(() => {
    if (record && !compact && !previewLogged.current) {
      previewLogged.current = true;
      void logCcAuditPreviewed(actor, changeId, record.change_control_number);
    }
  }, [record, compact, actor, changeId]);

  const handleExportPdf = async () => {
    if (!canExport) return toast.error('No export permission');
    if (!record) return;
    openCcAuditPdfReport(entries, record.change_control_number, actor.name, filters);
    await logCcAuditExport(actor, changeId, record.change_control_number, 'PDF', entries.length);
    toast.success('PDF export placeholder opened (audit logged)');
  };

  const handleExportExcel = async () => {
    if (!canExport) return toast.error('No export permission');
    if (!record) return;
    const { headers, rows } = exportCcAuditCsv(entries);
    downloadCsv(`${record.change_control_number}-audit-trail.csv`, headers, rows);
    await logCcAuditExport(actor, changeId, record.change_control_number, 'Excel', entries.length);
    toast.success('Excel export downloaded (audit logged)');
  };

  const content = (
    <div className="space-y-4">
      {showHeader && record && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono font-bold text-lg">{record.change_control_number}</span>
          <CcStatusBadge status={record.status} />
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
          <KpiCard label="Validation" value={dashboard.validationActivities} accent="border-l-violet-600" />
          <KpiCard label="Training" value={dashboard.trainingActivities} accent="border-l-sky-600" />
          <KpiCard label="Approval" value={dashboard.approvalActivities} accent="border-l-green-600" />
          <KpiCard label="Closure" value={dashboard.closureActivities} accent="border-l-slate-600" />
          <KpiCard label="Export Activities" value={dashboard.exportActivities} accent="border-l-amber-600" />
        </div>
      )}

      <FilterPanel
        search={search} setSearch={setSearch} changeNumber="" setChangeNumber={() => {}}
        actionFilter={actionFilter} setActionFilter={setActionFilter}
        moduleFilter={moduleFilter} setModuleFilter={setModuleFilter}
        userFilter={userFilter} setUserFilter={setUserFilter}
        departmentFilter={departmentFilter} setDepartmentFilter={setDepartmentFilter}
        startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate}
        departments={departments} users={users} canExport={canExport}
        validationImpactOnly={validationImpactOnly} setValidationImpactOnly={setValidationImpactOnly}
        csvImpactOnly={csvImpactOnly} setCsvImpactOnly={setCsvImpactOnly}
        criticalOnly={criticalOnly} setCriticalOnly={setCriticalOnly}
        onExportPdf={() => void handleExportPdf()} onExportExcel={() => void handleExportExcel()}
        onPageReset={() => setPage(1)} showChangeNumber={false}
      />

      {loading ? <LoadingSkeleton rows={3} /> : error ? (
        <ErrorCard title="Load error" message={error} onRetry={load} />
      ) : !entries.length ? (
        <EmptyState title="No audit trail entries" message="No activity logged for this change control yet, or filters exclude all records." />
      ) : (
        <AuditTabsContent
          entries={entries}
          paginatedItems={paginated.items}
          tablePage={paginated.page}
          tableTotalPages={paginated.totalPages}
          tableTotal={entries.length}
          onTablePrev={() => setPage((p) => p - 1)}
          onTableNext={() => setPage((p) => p + 1)}
          compact={compact}
        />
      )}

      {readOnly && <p className="text-xs text-muted-foreground text-center">Auditor access: read-only. No edit or delete permitted.</p>}
    </div>
  );

  if (compact) return content;

  return (
    <CcAuditTrailAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Change Control Audit Trail"
          description="Complete GMP, GAMP5 and Annex 11 compliant activity history"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/change-control' },
            { label: 'Change Control', href: '/qms/change-control' },
            { label: record?.change_control_number || 'Audit Trail' },
          ]}
        />
        {content}
      </div>
    </CcAuditTrailAccessGuard>
  );
}

export function CcAuditTrailListPage() {
  const { user, profile } = useAuth();
  const role = profile?.role;
  const canExport = canExportCcAuditTrail(role);
  const readOnly = isCcAuditReadOnly(role);

  const [allEntries, setAllEntries] = useState<CcAuditEntry[]>([]);
  const [criticalChangeIds, setCriticalChangeIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState('');
  const [changeNumber, setChangeNumber] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [validationImpactOnly, setValidationImpactOnly] = useState(false);
  const [csvImpactOnly, setCsvImpactOnly] = useState(false);
  const [criticalOnly, setCriticalOnly] = useState(false);

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || 'System',
    role: role || '',
    department: profile?.department || '',
  }), [user?.uid, profile?.full_name, profile?.department, role]);

  const filters: CcAuditFilters = useMemo(() => ({
    search, change_number: changeNumber, action_type: actionFilter, module_name: moduleFilter,
    user_id: userFilter, department: departmentFilter, start_date: startDate, end_date: endDate,
    validation_impact_only: validationImpactOnly, csv_impact_only: csvImpactOnly,
    critical_only: criticalOnly,
  }), [search, changeNumber, actionFilter, moduleFilter, userFilter, departmentFilter, startDate, endDate, validationImpactOnly, csvImpactOnly, criticalOnly]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, changes] = await Promise.all([
        getFilteredCcAuditTrail({
          role, userDepartment: profile?.department, userId: user?.uid, filters: {},
        }),
        listChanges(),
      ]);
      setAllEntries(rows);
      setCriticalChangeIds(new Set(changes.filter((r) => r.change_category === 'Critical').map((r) => r.id)));
      setPage(1);
    } catch {
      setError('Failed to load Change Control audit trail.');
    } finally {
      setLoading(false);
    }
  }, [role, profile?.department, user?.uid]);

  useEffect(() => { void load(); }, [load]);

  const entries = useMemo(() => {
    let filtered = applyCcAuditFilters(allEntries, filters);
    if (criticalOnly) {
      filtered = filtered.filter((e) => criticalChangeIds.has(e.change_control_id));
    }
    return sortCcAuditEntriesDesc(filtered);
  }, [allEntries, filters, criticalOnly, criticalChangeIds]);
  const dashboard = useMemo(() => computeCcAuditDashboard(entries), [entries]);
  const paginated = useMemo(() => paginateCcAuditEntries(entries, page, PAGE_SIZE), [entries, page]);
  const departments = useMemo(() => ['All', ...Array.from(new Set(allEntries.map((e) => e.department).filter(Boolean))).sort()], [allEntries]);
  const users = useMemo(() => getUniqueAuditUsers(allEntries), [allEntries]);

  const handleExportPdf = async () => {
    if (!canExport) return toast.error('No export permission');
    openCcAuditPdfReport(entries, 'All Changes', actor.name, filters);
    await logCcAuditExport(actor, 'workspace', 'All Changes', 'PDF', entries.length);
    toast.success('PDF export placeholder opened (audit logged)');
  };

  const handleExportExcel = async () => {
    if (!canExport) return toast.error('No export permission');
    const { headers, rows } = exportCcAuditCsv(entries);
    downloadCsv(`change-control-audit-trail-${Date.now()}.csv`, headers, rows);
    await logCcAuditExport(actor, 'workspace', 'All Changes', 'Excel', entries.length);
    toast.success('Excel export downloaded (audit logged)');
  };

  return (
    <CcAuditTrailAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Change Control Audit Trail"
          description="Complete GMP, GAMP5 and Annex 11 compliant activity history"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/change-control' },
            { label: 'Change Control', href: '/qms/change-control' },
            { label: 'Audit Trail' },
          ]}
        />

        {!loading && !error && (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
            <KpiCard label="Total Audit Logs" value={dashboard.total} />
            <KpiCard label="Today's Activities" value={dashboard.todayActivities} accent="border-l-blue-600" />
            <KpiCard label="Implementation" value={dashboard.implementationActivities} accent="border-l-purple-600" />
            <KpiCard label="Validation" value={dashboard.validationActivities} accent="border-l-violet-600" />
            <KpiCard label="Training" value={dashboard.trainingActivities} accent="border-l-sky-600" />
            <KpiCard label="Approval" value={dashboard.approvalActivities} accent="border-l-green-600" />
            <KpiCard label="Closure" value={dashboard.closureActivities} accent="border-l-slate-600" />
            <KpiCard label="Export Activities" value={dashboard.exportActivities} accent="border-l-amber-600" />
          </div>
        )}

        <FilterPanel
          search={search} setSearch={setSearch} changeNumber={changeNumber} setChangeNumber={setChangeNumber}
          actionFilter={actionFilter} setActionFilter={setActionFilter}
          moduleFilter={moduleFilter} setModuleFilter={setModuleFilter}
          userFilter={userFilter} setUserFilter={setUserFilter}
          departmentFilter={departmentFilter} setDepartmentFilter={setDepartmentFilter}
          startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate}
          departments={departments} users={users} canExport={canExport}
          validationImpactOnly={validationImpactOnly} setValidationImpactOnly={setValidationImpactOnly}
          csvImpactOnly={csvImpactOnly} setCsvImpactOnly={setCsvImpactOnly}
          criticalOnly={criticalOnly} setCriticalOnly={setCriticalOnly}
          onExportPdf={() => void handleExportPdf()} onExportExcel={() => void handleExportExcel()}
          onPageReset={() => setPage(1)}
        />

        {loading ? <LoadingSkeleton rows={3} /> : error ? (
          <ErrorCard title="Load error" message={error} onRetry={load} />
        ) : entries.length ? (
          <AuditTabsContent
            entries={entries}
            paginatedItems={paginated.items}
            tablePage={paginated.page}
            tableTotalPages={paginated.totalPages}
            tableTotal={entries.length}
            onTablePrev={() => setPage((p) => p - 1)}
            onTableNext={() => setPage((p) => p + 1)}
          />
        ) : (
          <EmptyState title="No audit entries" message="Change control audit activity will appear here as actions are performed across the module." />
        )}

        {readOnly && <p className="text-xs text-muted-foreground text-center">Auditor access: read-only. No edit or delete permitted.</p>}
      </div>
    </CcAuditTrailAccessGuard>
  );
}
