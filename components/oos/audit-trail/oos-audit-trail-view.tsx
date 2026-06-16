'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, FileSpreadsheet, FileText, Lock, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  OOS_AUDIT_ACTION_TYPES,
  OOS_AUDIT_MODULES,
  applyOosAuditFilters,
  canExportOosAuditTrail,
  computeOosAuditDashboard,
  exportOosAuditCsv,
  isOosAuditReadOnly,
  paginateOosAuditEntries,
  type OosAuditEntry,
  type OosAuditFilters,
} from '@/lib/oos-audit-trail-records';
import {
  getFilteredOosAuditTrail,
  logOosAuditExport,
  logOosAuditPreviewed,
  openOosAuditPdfReport,
} from '@/lib/oos-audit-trail-service';
import { getOosById } from '@/lib/oos-service';
import { downloadCsv } from '@/lib/export-utils';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { OosAuditTimeline } from './oos-audit-timeline';
import { OosAuditTable } from './oos-audit-table';
import { OosAuditTrailAccessGuard } from './oos-audit-trail-access-guard';
import { OosStatusBadge } from '@/components/oos/oos-sub-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { OosRecord } from '@/lib/oos-types';

const PAGE_SIZE = 20;

interface OosAuditTrailViewProps {
  oosId: string;
  compact?: boolean;
  showHeader?: boolean;
}

export function OosAuditTrailView({
  oosId,
  compact,
  showHeader = true,
}: OosAuditTrailViewProps) {
  const { user, profile } = useAuth();
  const role = profile?.role;
  const canExport = canExportOosAuditTrail(role);
  const readOnly = isOosAuditReadOnly(role);

  const [record, setRecord] = useState<OosRecord | null>(null);
  const [allEntries, setAllEntries] = useState<OosAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const previewLogged = useRef(false);

  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || 'System',
    role: role || '',
    department: profile?.department || '',
  }), [user?.uid, profile?.full_name, profile?.department, role]);

  const filters: OosAuditFilters = useMemo(() => ({
    search,
    action_type: actionFilter,
    module_name: moduleFilter,
    start_date: startDate,
    end_date: endDate,
  }), [search, actionFilter, moduleFilter, startDate, endDate]);

  const load = useCallback(async () => {
    if (!oosId) {
      setError('OOS ID is required');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const oos = await getOosById(oosId);
      if (!oos) {
        setError('OOS record not found');
        setRecord(null);
        setAllEntries([]);
        return;
      }
      setRecord(oos);
      const rows = await getFilteredOosAuditTrail({
        oosId,
        oosNumber: oos.oos_number,
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
  }, [oosId, role, profile?.department, user?.uid]);

  useEffect(() => { void load(); }, [load]);

  const entries = useMemo(
    () => applyOosAuditFilters(allEntries, filters),
    [allEntries, filters],
  );

  const paginated = useMemo(
    () => paginateOosAuditEntries(entries, page, PAGE_SIZE),
    [entries, page],
  );

  useEffect(() => {
    if (record && !compact && !previewLogged.current) {
      previewLogged.current = true;
      void logOosAuditPreviewed(actor, oosId, record.oos_number);
    }
  }, [record, compact, actor, oosId]);

  const handleExportPdf = async () => {
    if (!canExport) return toast.error('No export permission');
    if (!record) return;
    openOosAuditPdfReport(entries, record.oos_number, actor.name, filters);
    await logOosAuditExport(actor, oosId, record.oos_number, 'PDF', entries.length);
    toast.success('PDF export placeholder opened (audit logged)');
  };

  const handleExportExcel = async () => {
    if (!canExport) return toast.error('No export permission');
    if (!record) return;
    const { headers, rows } = exportOosAuditCsv(entries);
    downloadCsv(`${record.oos_number}-audit-trail.csv`, headers, rows);
    await logOosAuditExport(actor, oosId, record.oos_number, 'Excel', entries.length);
    toast.success('Excel export downloaded (audit logged)');
  };

  const content = (
    <div className="space-y-4">
      {showHeader && record && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono font-bold text-lg">{record.oos_number}</span>
          <OosStatusBadge status={record.status} />
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground border rounded-full px-2 py-0.5">
            <Lock className="h-3 w-3" /> Read-only · Append-only audit log
          </span>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
          {!compact && (
            <CardDescription>Search audit logs. Records cannot be edited or deleted.</CardDescription>
          )}
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1 sm:col-span-2">
            <Label>Search</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Field, action, user, value..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Action Type</Label>
            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {OOS_AUDIT_ACTION_TYPES.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Module</Label>
            <Select value={moduleFilter} onValueChange={(v) => { setModuleFilter(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                {OOS_AUDIT_MODULES.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>From Date</Label>
            <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} />
          </div>
          <div className="space-y-1">
            <Label>To Date</Label>
            <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} />
          </div>
          {canExport && (
            <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
              <Button variant="outline" size="sm" onClick={() => void handleExportPdf()}>
                <FileText className="mr-1 h-4 w-4" /> Export PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => void handleExportExcel()}>
                <FileSpreadsheet className="mr-1 h-4 w-4" /> Export Excel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <LoadingSkeleton rows={3} />
      ) : error ? (
        <ErrorCard title="Load error" message={error} />
      ) : !entries.length ? (
        <EmptyState
          title="No audit trail entries"
          message="No activity has been logged for this OOS yet, or filters exclude all records."
        />
      ) : (
        <Tabs defaultValue="timeline">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="table">Table</TabsTrigger>
            </TabsList>
            <p className="text-xs text-muted-foreground">
              {entries.length} record(s) · Page {paginated.page} of {paginated.totalPages}
            </p>
          </div>
          <TabsContent value="timeline" className="mt-4">
            <OosAuditTimeline entries={paginated.items} grouped />
          </TabsContent>
          <TabsContent value="table" className="mt-4 space-y-3">
            <OosAuditTable entries={paginated.items} compact={compact} />
            {paginated.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {paginated.page} of {paginated.totalPages}
                </span>
                <Button variant="outline" size="sm" disabled={page >= paginated.totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {readOnly && (
        <p className="text-xs text-muted-foreground text-center">Auditor access: read-only. Export permitted when authorized.</p>
      )}
    </div>
  );

  if (compact) return content;

  return (
    <OosAuditTrailAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="OOS Audit Trail"
          description="Complete activity history and GMP audit trail for OOS records"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/oos' },
            { label: 'OOS Management', href: '/qms/oos' },
            { label: record?.oos_number || 'Audit Trail' },
          ]}
        />
        {content}
      </div>
    </OosAuditTrailAccessGuard>
  );
}

export function OosAuditTrailListPage() {
  const { user, profile } = useAuth();
  const role = profile?.role;
  const canExport = canExportOosAuditTrail(role);
  const readOnly = isOosAuditReadOnly(role);

  const [allEntries, setAllEntries] = useState<OosAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState('');
  const [oosNumber, setOosNumber] = useState('');
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

  const filters: OosAuditFilters = useMemo(() => ({
    search,
    oos_number: oosNumber,
    action_type: actionFilter,
    module_name: moduleFilter,
    department: departmentFilter,
    start_date: startDate,
    end_date: endDate,
  }), [search, oosNumber, actionFilter, moduleFilter, departmentFilter, startDate, endDate]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await getFilteredOosAuditTrail({
        role,
        userDepartment: profile?.department,
        userId: user?.uid,
        filters: {},
      });
      setAllEntries(rows);
      setPage(1);
    } catch {
      setError('Failed to load OOS audit trail.');
    } finally {
      setLoading(false);
    }
  }, [role, profile?.department, user?.uid]);

  useEffect(() => { void load(); }, [load]);

  const entries = useMemo(
    () => applyOosAuditFilters(allEntries, filters),
    [allEntries, filters],
  );

  const dashboard = useMemo(() => computeOosAuditDashboard(entries), [entries]);
  const paginated = useMemo(
    () => paginateOosAuditEntries(entries, page, PAGE_SIZE),
    [entries, page],
  );

  const departments = useMemo(() => {
    const set = new Set(allEntries.map((e) => e.department).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [allEntries]);

  const handleExportPdf = async () => {
    if (!canExport) return toast.error('No export permission');
    openOosAuditPdfReport(entries, 'All OOS', actor.name, filters);
    await logOosAuditExport(actor, 'workspace', 'All OOS', 'PDF', entries.length);
    toast.success('PDF export placeholder opened (audit logged)');
  };

  const handleExportExcel = async () => {
    if (!canExport) return toast.error('No export permission');
    const { headers, rows } = exportOosAuditCsv(entries);
    downloadCsv(`oos-audit-trail-${Date.now()}.csv`, headers, rows);
    await logOosAuditExport(actor, 'workspace', 'All OOS', 'Excel', entries.length);
    toast.success('Excel export downloaded (audit logged)');
  };

  return (
    <OosAuditTrailAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="OOS Audit Trail"
          description="Complete activity history and GMP audit trail for OOS records"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/oos' },
            { label: 'OOS Management', href: '/qms/oos' },
            { label: 'Audit Trail' },
          ]}
        />

        {!loading && !error && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Total Audit Logs" value={dashboard.total} />
            <KpiCard label="Today's Activities" value={dashboard.todayActivities} tone="blue" />
            <KpiCard label="Approval Activities" value={dashboard.approvalActivities} tone="green" />
            <KpiCard label="Investigation Activities" value={dashboard.investigationActivities} tone="amber" />
            <KpiCard label="CAPA Activities" value={dashboard.capaActivities} tone="amber" />
            <KpiCard label="Closure Activities" value={dashboard.closureActivities} tone="green" />
            <KpiCard label="Reopened Cases" value={dashboard.reopenedCases} tone="red" />
            <KpiCard label="Export Activities" value={dashboard.exportActivities} tone="blue" />
          </div>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filter Panel</CardTitle>
            <CardDescription>Filter by OOS number, action, module, department, or date range. Read-only — no edit or delete.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1 sm:col-span-2 lg:col-span-3">
              <Label>Search</Label>
              <div className="relative max-w-lg">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Search actions, users, fields, values..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>OOS Number</Label>
              <Input
                placeholder="OOS-..."
                value={oosNumber}
                onChange={(e) => { setOosNumber(e.target.value); setPage(1); }}
              />
            </div>
            <div className="space-y-1">
              <Label>Action Type</Label>
              <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {OOS_AUDIT_ACTION_TYPES.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Module Name</Label>
              <Select value={moduleFilter} onValueChange={(v) => { setModuleFilter(v); setPage(1); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modules</SelectItem>
                  {OOS_AUDIT_MODULES.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Department</Label>
              <Select value={departmentFilter} onValueChange={(v) => { setDepartmentFilter(v); setPage(1); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d} value={d === 'All' ? 'all' : d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>From Date</Label>
              <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} />
            </div>
            <div className="space-y-1">
              <Label>To Date</Label>
              <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} />
            </div>
            {canExport && (
              <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
                <Button variant="outline" size="sm" onClick={() => void handleExportPdf()}>
                  <FileText className="mr-1 h-4 w-4" /> Export PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => void handleExportExcel()}>
                  <FileSpreadsheet className="mr-1 h-4 w-4" /> Export Excel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {loading ? <LoadingSkeleton rows={3} /> : error ? (
          <ErrorCard title="Load error" message={error} />
        ) : entries.length ? (
          <div className="space-y-3">
            <Tabs defaultValue="table">
              <TabsList>
                <TabsTrigger value="table">Table View</TabsTrigger>
                <TabsTrigger value="timeline">Timeline View</TabsTrigger>
              </TabsList>
              <TabsContent value="table" className="mt-4">
                <OosAuditTable entries={paginated.items} />
              </TabsContent>
              <TabsContent value="timeline" className="mt-4">
                <OosAuditTimeline entries={paginated.items} grouped />
              </TabsContent>
            </Tabs>
            {paginated.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {paginated.page} of {paginated.totalPages} · {entries.length} total
                </span>
                <Button variant="outline" size="sm" disabled={page >= paginated.totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        ) : (
          <EmptyState title="No audit entries" message="OOS audit activity will appear here as actions are performed across the module." />
        )}

        {readOnly && (
          <p className="text-xs text-muted-foreground text-center">Auditor access: read-only. Export permitted when authorized.</p>
        )}
      </div>
    </OosAuditTrailAccessGuard>
  );
}
