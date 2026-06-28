'use client';

import { useCallback, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Lock, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { TmsPageHeader } from '@/components/training/tms-page-header';
import { useTrainingAuditTrail } from '@/hooks/use-training-audit-trail';
import {
  paginateTrainingAuditEntries, getEntityHistory, getUserActivitySummary,
  exportTrainingAuditCsv, type TrainingAuditFilters, type TrainingAuditEntry,
} from '@/lib/training-audit-trail-records';
import {
  logTrainingAuditExport, openTrainingAuditPrintReport, exportTrainingAuditExcel,
} from '@/lib/training-audit-trail-service';
import { downloadCsv } from '@/lib/export-utils';
import { AuditTable } from './audit-table';
import { AuditTimeline } from './audit-timeline';
import { AuditDetailsDrawer } from './audit-details-drawer';
import { FilterPanel } from './filter-panel';
import { ExportMenu } from './export-menu';
import { ActivityCard } from './activity-card';
import { AuditDashboardCharts } from './audit-dashboard-charts';
import { formatAuditDateTimeLocal } from '@/lib/training-audit-trail-records';

const PAGE_SIZE = 20;

const KPI_CONFIG = [
  { label: 'Total Events', key: 'totalEvents' as const, tone: 'blue' as const },
  { label: "Today's Events", key: 'todayEvents' as const, tone: 'green' as const },
  { label: 'Critical Events', key: 'criticalEvents' as const, tone: 'red' as const },
  { label: 'Approvals', key: 'approvals' as const, tone: 'green' as const },
  { label: 'Rejected', key: 'rejectedActions' as const, tone: 'red' as const },
  { label: 'Certificate Events', key: 'certificateEvents' as const, tone: 'blue' as const },
  { label: 'Retraining Events', key: 'retrainingEvents' as const, tone: 'amber' as const },
  { label: 'Exports', key: 'exports' as const, tone: 'amber' as const },
  { label: 'Logins', key: 'logins' as const, tone: 'blue' as const },
  { label: 'E-Signatures', key: 'electronicSignatures' as const, tone: 'blue' as const },
];

interface TrainingAuditTrailPageProps {
  defaultTab?: 'timeline' | 'table' | 'entity' | 'users';
}

export function TrainingAuditTrailPage({ defaultTab = 'timeline' }: TrainingAuditTrailPageProps) {
  const [filters, setFilters] = useState<TrainingAuditFilters>({});
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [selectedEntry, setSelectedEntry] = useState<TrainingAuditEntry | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [entityIdFilter, setEntityIdFilter] = useState('');

  const {
    entries, kpis, charts, users, loading, refreshing, error, refresh,
    canView, canExport, isReadOnly, actor,
  } = useTrainingAuditTrail(filters);

  const paginated = useMemo(() => paginateTrainingAuditEntries(entries, page, PAGE_SIZE), [entries, page]);
  const entityHistory = useMemo(() => {
    if (!entityIdFilter.trim()) return [];
    return getEntityHistory(entries, entityIdFilter.trim());
  }, [entries, entityIdFilter]);
  const userActivities = useMemo(() => getUserActivitySummary(entries), [entries]);

  const handleSelect = useCallback((entry: TrainingAuditEntry) => {
    setSelectedEntry(entry);
    setDrawerOpen(true);
  }, []);

  const handleExportCsv = useCallback(async () => {
    const { headers, rows } = exportTrainingAuditCsv(entries);
    downloadCsv('training-audit-trail.csv', headers, rows);
    await logTrainingAuditExport(actor, 'CSV', entries.length);
    toast.success('CSV exported');
  }, [entries, actor]);

  const handleExportExcel = useCallback(async () => {
    await exportTrainingAuditExcel(entries);
    await logTrainingAuditExport(actor, 'Excel', entries.length);
    toast.success('Excel export downloaded');
  }, [entries, actor]);

  const handlePrint = useCallback(async () => {
    openTrainingAuditPrintReport(entries, actor.name, filters);
    await logTrainingAuditExport(actor, 'PDF', entries.length);
  }, [entries, actor, filters]);

  const userColumns = [
    { key: 'user', header: 'User', render: (r: { user: string }) => r.user },
    { key: 'role', header: 'Role', render: (r: { role: string }) => r.role || '—' },
    { key: 'count', header: 'Actions', render: (r: { count: number }) => r.count },
    { key: 'last', header: 'Last Activity', render: (r: { lastActivity: string }) => formatAuditDateTimeLocal(r.lastActivity) },
  ];

  if (!canView) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>Employees do not have access to the Training Audit Trail. Contact QA or your Training Coordinator.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <TmsPageHeader
        title="Training Audit Trail"
        description="Inspection-ready audit logs for all GMP training activities."
        trail={[{ label: 'Audit Trail' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={refresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <ExportMenu canExport={canExport && !isReadOnly} onExportCsv={handleExportCsv} onExportExcel={handleExportExcel} onPrint={handlePrint} />
          </div>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 text-xs">21 CFR Part 11</Badge>
        <Badge variant="outline" className="text-xs">EU GMP Annex 11</Badge>
        <Badge variant="outline" className="text-xs">ALCOA+</Badge>
        <Badge variant="outline" className="text-xs">GAMP 5</Badge>
        <Badge variant="outline" className="text-xs gap-1"><Lock className="h-3 w-3" /> Immutable</Badge>
      </div>

      {isReadOnly && (
        <Alert><AlertTitle>Read-Only Access</AlertTitle><AlertDescription>Auditor view — records cannot be modified.</AlertDescription></Alert>
      )}

      {error && <ErrorCard message={error} onRetry={refresh} />}

      <FilterPanel filters={filters} users={users} onChange={setFilters} onPageReset={() => setPage(1)} />

      {loading ? <LoadingSkeleton rows={8} /> : kpis && charts ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {KPI_CONFIG.map(({ label, key, tone }) => (
              <KpiCard key={key} label={label} value={kpis[key]} tone={tone} />
            ))}
          </div>

          <AuditDashboardCharts charts={charts} />

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="timeline">Timeline View</TabsTrigger>
              <TabsTrigger value="table">Audit Table</TabsTrigger>
              <TabsTrigger value="entity">Entity History</TabsTrigger>
              <TabsTrigger value="users">User Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="mt-4 space-y-4">
              <AuditTimeline entries={paginated.items} />
              <PaginationBar page={paginated.page} totalPages={paginated.totalPages} total={paginated.total} onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => Math.min(paginated.totalPages, p + 1))} />
            </TabsContent>

            <TabsContent value="table" className="mt-4 space-y-4">
              <AuditTable entries={paginated.items} onSelect={handleSelect} />
              <PaginationBar page={paginated.page} totalPages={paginated.totalPages} total={paginated.total} onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => Math.min(paginated.totalPages, p + 1))} />
            </TabsContent>

            <TabsContent value="entity" className="mt-4 space-y-4">
              <div className="flex gap-2 max-w-md">
                <Input placeholder="Entity ID (record/assignment ID)…" value={entityIdFilter} onChange={(e) => setEntityIdFilter(e.target.value)} />
              </div>
              {entityIdFilter.trim() ? (
                entityHistory.length ? (
                  <>
                    <AuditTimeline entries={entityHistory} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {entityHistory.slice(0, 6).map((e) => (
                        <ActivityCard key={e.id || e.audit_id} entry={e} onClick={() => handleSelect(e)} />
                      ))}
                    </div>
                  </>
                ) : (
                  <EmptyState title="No history" message={`No audit events found for entity ${entityIdFilter}`} />
                )
              ) : (
                <EmptyState title="Enter Entity ID" message="Provide a training record or assignment ID to view its complete audit history." />
              )}
            </TabsContent>

            <TabsContent value="users" className="mt-4">
              {userActivities.length ? (
                <ResponsiveDataTable
                  columns={userColumns}
                  data={userActivities.map((u, i) => ({ id: String(i), ...u }))}
                  mobileTitleKey="user"
                  mobileSubtitleKey="role"
                  pageSize={15}
                />
              ) : (
                <EmptyState title="No user activity" message="User activity will appear as training actions are logged." />
              )}
            </TabsContent>
          </Tabs>
        </>
      ) : null}

      <AuditDetailsDrawer entry={selectedEntry} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
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
