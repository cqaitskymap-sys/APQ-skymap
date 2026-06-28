'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Download, Eye, RefreshCw, Printer, Archive, Plus, Star, LayoutGrid, List } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { DmsPageHeader } from '@/components/dms/dms-page-header';
import { useSopManagement } from '@/hooks/use-sop-management';
import { SopCharts } from '@/components/sop/sop-charts';
import { SopStatusBadge, SopCard, LoadingSkeleton as SopSkeleton } from '@/components/sop/sop-ui';
import { exportSopCsv, exportSopExcel, bulkSopAction, logSopExported, toggleSopFavorite } from '@/lib/sop-service';
import type { SopKpis } from '@/lib/sop-types';
import { SOP_CATEGORIES } from '@/lib/sop-types';
import {
  getLatestSops, getPendingSopReviews, getPendingSopApprovals, getUpcomingEffectiveSops,
  getTrainingPendingSops, getOverdueSopReviews, getRecentSopRevisions, SOP_KPI_FILTER_MAP,
} from '@/lib/sop-records';
import { DMS_DEPARTMENTS } from '@/lib/dms-types';
import { cn } from '@/lib/utils';

const KPI_ITEMS: { label: string; key: keyof SopKpis; filterKey?: string; tone?: 'blue' | 'green' | 'amber' | 'red' }[] = [
  { label: 'Total SOPs', key: 'totalSops', tone: 'blue' },
  { label: 'Effective SOPs', key: 'effectiveSops', filterKey: 'effective', tone: 'green' },
  { label: 'Draft SOPs', key: 'draftSops', filterKey: 'draft' },
  { label: 'Pending Review', key: 'pendingReview', filterKey: 'pending_review', tone: 'amber' },
  { label: 'Pending Approval', key: 'pendingApproval', filterKey: 'pending_approval', tone: 'amber' },
  { label: 'Training Pending', key: 'trainingPending', filterKey: 'training_pending', tone: 'amber' },
  { label: 'Review Due', key: 'reviewDue', filterKey: 'review_due', tone: 'amber' },
  { label: 'Overdue Reviews', key: 'overdueReviews', filterKey: 'overdue', tone: 'red' },
  { label: 'Archived SOPs', key: 'archivedSops', filterKey: 'archived' },
  { label: 'Obsolete SOPs', key: 'obsoleteSops', filterKey: 'obsolete', tone: 'red' },
];

export function SopManagementPage() {
  return (
    <Suspense fallback={<LoadingSkeleton rows={8} />}>
      <SopManagementContent />
    </Suspense>
  );
}

function SopManagementContent() {
  const searchParams = useSearchParams();
  const viewedLogged = useRef(false);
  const [activeKpi, setActiveKpi] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  const {
    records, paginatedRecords, metrics, charts, filters, setFilters,
    loading, refreshing, error, refresh, actor, page, setPage, totalPages,
    pagination, selectedIds, toggleSelect, toggleSelectAll, clearSelection,
    logViewed, canExport, canBulk, canCreate, isReadOnly,
  } = useSopManagement();

  useEffect(() => {
    if (!viewedLogged.current && !loading && actor.id) {
      viewedLogged.current = true;
      void logViewed();
    }
  }, [loading, actor.id, logViewed]);

  useEffect(() => {
    const kpi = searchParams.get('kpi');
    if (kpi && SOP_KPI_FILTER_MAP[kpi]) {
      setActiveKpi(kpi);
      setFilters((prev) => ({ ...prev, ...SOP_KPI_FILTER_MAP[kpi] }));
    }
  }, [searchParams, setFilters]);

  const handleKpiClick = (filterKey?: string) => {
    if (!filterKey) return;
    const isActive = activeKpi === filterKey;
    setActiveKpi(isActive ? null : filterKey);
    setFilters(isActive ? {} : SOP_KPI_FILTER_MAP[filterKey] || {});
    setPage(1);
  };

  const handleExportCsv = useCallback(() => {
    if (!records.length) { toast.error('No SOPs to export'); return; }
    exportSopCsv(records);
    void logSopExported(actor, 'csv', records.length);
    toast.success('SOP data exported');
  }, [records, actor]);

  const handleExportExcel = useCallback(() => {
    if (!records.length) { toast.error('No SOPs to export'); return; }
    exportSopExcel(records);
    void logSopExported(actor, 'excel', records.length);
    toast.success('Excel export downloaded');
  }, [records, actor]);

  const handlePrint = useCallback(() => {
    if (!records.length) { toast.error('No SOPs to print'); return; }
    void logSopExported(actor, 'print', records.length);
    window.print();
  }, [records, actor]);

  const handleBulkArchive = useCallback(async () => {
    if (!selectedIds.length) { toast.error('Select SOPs first'); return; }
    const reason = window.prompt('Reason for bulk archive:');
    if (!reason) return;
    try {
      const count = await bulkSopAction(selectedIds, 'archive', reason, actor);
      toast.success(`Archived ${count} SOP(s)`);
      clearSelection();
      await refresh(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bulk archive failed');
    }
  }, [selectedIds, actor, clearSelection, refresh]);

  const handleFavorite = useCallback(async (id: string) => {
    try {
      await toggleSopFavorite(id, actor);
      await refresh(true);
    } catch { toast.error('Failed to update favorite'); }
  }, [actor, refresh]);

  if (loading && !records.length) return <SopSkeleton rows={8} />;
  if (error) return <ErrorCard message={error} onRetry={() => refresh()} />;

  return (
    <div className="space-y-6 animate-in fade-in print:space-y-4">
      <DmsPageHeader
        title="SOP Management"
        description="Manage pharmaceutical Standard Operating Procedures throughout their lifecycle."
        trail={[{ label: 'SOP Management' }]}
        actions={
          <>
            {canCreate && (
              <Button size="sm" asChild>
                <Link href="/qms/documents/sop/create"><Plus className="h-4 w-4 mr-1" /> Create SOP</Link>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => refresh(true)} disabled={refreshing}>
              <RefreshCw className={cn('h-4 w-4 mr-1', refreshing && 'animate-spin')} /> Refresh
            </Button>
            {canExport && (
              <>
                <Button variant="outline" size="sm" onClick={handleExportCsv}><Download className="h-4 w-4 mr-1" /> CSV</Button>
                <Button variant="outline" size="sm" onClick={handleExportExcel}><Download className="h-4 w-4 mr-1" /> Excel</Button>
                <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4 mr-1" /> Print</Button>
              </>
            )}
            {canBulk && selectedIds.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleBulkArchive}>
                <Archive className="h-4 w-4 mr-1" /> Bulk Archive ({selectedIds.length})
              </Button>
            )}
          </>
        }
      />

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Input placeholder="Search SOPs..." value={filters.search || ''}
              onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1); }}
              className="max-w-xs" />
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.department || ''}
              onChange={(e) => { setFilters({ ...filters, department: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Departments</option>
              {DMS_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.category || ''}
              onChange={(e) => { setFilters({ ...filters, category: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Categories</option>
              {SOP_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.status || ''}
              onChange={(e) => { setFilters({ ...filters, status: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Statuses</option>
              {['Draft', 'Department Review', 'QA Review', 'Pending Approval', 'Effective', 'Periodic Review', 'Archived', 'Obsolete'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <Button variant={filters.favorites ? 'default' : 'outline'} size="sm"
              onClick={() => setFilters({ ...filters, favorites: !filters.favorites })}>
              <Star className="h-4 w-4 mr-1" /> Favorites
            </Button>
            <div className="flex gap-1 ml-auto">
              <Button variant={viewMode === 'table' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('table')}><List className="h-4 w-4" /></Button>
              <Button variant={viewMode === 'grid' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('grid')}><LayoutGrid className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {KPI_ITEMS.map((item) => (
          item.filterKey ? (
            <button key={item.key} type="button" onClick={() => handleKpiClick(item.filterKey)}
              className={cn('text-left', activeKpi === item.filterKey && 'ring-2 ring-blue-500 rounded-lg')}>
              <KpiCard label={item.label} value={metrics[item.key]} tone={item.tone} />
            </button>
          ) : (
            <KpiCard key={item.key} label={item.label} value={metrics[item.key]} tone={item.tone} />
          )
        ))}
      </div>

      <SopCharts charts={charts} />

      <Tabs defaultValue="latest" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="latest">Latest SOPs ({records.length})</TabsTrigger>
          <TabsTrigger value="review">Pending Reviews ({getPendingSopReviews(records).length})</TabsTrigger>
          <TabsTrigger value="approval">Pending Approvals ({getPendingSopApprovals(records).length})</TabsTrigger>
          <TabsTrigger value="effective">Upcoming Effective ({getUpcomingEffectiveSops(records).length})</TabsTrigger>
          <TabsTrigger value="training">Training Pending ({getTrainingPendingSops(records).length})</TabsTrigger>
          <TabsTrigger value="overdue">Overdue Reviews ({getOverdueSopReviews(records).length})</TabsTrigger>
          <TabsTrigger value="revisions">Recent Revisions ({getRecentSopRevisions(records).length})</TabsTrigger>
        </TabsList>

        <TabsContent value="latest">
          {viewMode === 'grid' ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {paginatedRecords.map((s) => (
                <Link key={s.id} href={`/qms/documents/sop/${s.id}`}>
                  <SopCard sop={s} onFavorite={canCreate ? handleFavorite : undefined} />
                </Link>
              ))}
            </div>
          ) : (
            <SopTable records={paginatedRecords} selectedIds={selectedIds} toggleSelect={toggleSelect}
              toggleSelectAll={toggleSelectAll} isReadOnly={isReadOnly} page={page} totalPages={totalPages}
              setPage={setPage} pagination={pagination} />
          )}
        </TabsContent>

        {[
          { value: 'review', data: getPendingSopReviews(records) },
          { value: 'approval', data: getPendingSopApprovals(records) },
          { value: 'effective', data: getUpcomingEffectiveSops(records) },
          { value: 'training', data: getTrainingPendingSops(records) },
          { value: 'overdue', data: getOverdueSopReviews(records) },
          { value: 'revisions', data: getRecentSopRevisions(records) },
        ].map(({ value, data }) => (
          <TabsContent key={value} value={value}>
            <SopTable records={data.slice(0, 20)} isReadOnly={isReadOnly} compact />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function SopTable({
  records, selectedIds, toggleSelect, toggleSelectAll, isReadOnly,
  page, totalPages, setPage, pagination, compact,
}: {
  records: import('@/lib/sop-types').SopMasterRecord[];
  selectedIds?: string[]; toggleSelect?: (id: string) => void;
  toggleSelectAll?: () => void; isReadOnly: boolean;
  page?: number; totalPages?: number; setPage?: (p: number) => void;
  pagination?: { page: number; pageSize: number; total: number; totalPages: number };
  compact?: boolean;
}) {
  if (!records.length) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground">No SOPs match filters.</CardContent></Card>;
  }
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {!isReadOnly && toggleSelect && <th className="p-3 w-10"><input type="checkbox" onChange={toggleSelectAll} className="rounded" /></th>}
                <th className="p-3 text-left font-medium">SOP Number</th>
                <th className="p-3 text-left font-medium">Title</th>
                <th className="p-3 text-left font-medium hidden md:table-cell">Version</th>
                <th className="p-3 text-left font-medium">Status</th>
                <th className="p-3 text-left font-medium hidden lg:table-cell">Department</th>
                <th className="p-3 text-left font-medium hidden lg:table-cell">Owner</th>
                <th className="p-3 text-left font-medium hidden xl:table-cell">Review Due</th>
                <th className="p-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b hover:bg-muted/30">
                  {!isReadOnly && toggleSelect && (
                    <td className="p-3"><input type="checkbox" checked={selectedIds?.includes(r.id)} onChange={() => toggleSelect(r.id)} className="rounded" /></td>
                  )}
                  <td className="p-3 font-mono text-xs">{r.sop_number}</td>
                  <td className="p-3 max-w-[200px] truncate">{r.sop_title}</td>
                  <td className="p-3 hidden md:table-cell">{r.version}</td>
                  <td className="p-3"><SopStatusBadge status={r.status} /></td>
                  <td className="p-3 hidden lg:table-cell text-muted-foreground">{r.department}</td>
                  <td className="p-3 hidden lg:table-cell text-muted-foreground">{r.owner_name}</td>
                  <td className="p-3 hidden xl:table-cell text-muted-foreground">{r.review_due_date || '—'}</td>
                  <td className="p-3">
                    <Link href={`/qms/documents/sop/${r.id}`} className="text-blue-600 hover:text-blue-800">
                      <Eye className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!compact && pagination && setPage && totalPages && totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <p className="text-sm text-muted-foreground">
              {(page! - 1) * pagination.pageSize + 1}–{Math.min(page! * pagination.pageSize, pagination.total)} of {pagination.total}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page! - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page! + 1)}>Next</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
