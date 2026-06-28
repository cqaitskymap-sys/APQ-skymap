'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, RefreshCw, Printer, Play, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { DmsPageHeader } from '@/components/dms/dms-page-header';
import { usePeriodicReviewManagement } from '@/hooks/use-periodic-review-management';
import { PrmCharts } from '@/components/periodic-review-management/prm-charts';
import {
  PeriodicReviewTable, ReviewScheduleTable, PeriodicReviewCalendar,
  LoadingSkeleton as PrmSkeleton,
} from '@/components/periodic-review-management/prm-ui';
import { DecisionWizard } from '@/components/periodic-review-management/decision-wizard';
import {
  exportPeriodicReviewsCsv, exportPeriodicReviewsExcel, logPeriodicReviewExported,
  logPeriodicReviewDashboardViewed, startPeriodicReview, completePeriodicReview, bulkScheduleReviews,
} from '@/lib/periodic-review-service';
import type { PeriodicReviewKpis, PeriodicReviewRecord } from '@/lib/periodic-review-types';
import { REVIEW_STATUSES, REVIEW_FREQUENCIES } from '@/lib/periodic-review-types';
import type { CompleteReviewInput } from '@/lib/periodic-review-schemas';
import {
  getUpcomingReviews, getOverdueReviews, getCompletedReviews, getReviewDecisions,
  getRecentlyRevised, getDueNextMonth, PRM_KPI_FILTER_MAP,
} from '@/lib/periodic-review-records';
import { DMS_DEPARTMENTS, DOCUMENT_TYPES } from '@/lib/dms-types';
import { cn } from '@/lib/utils';

const KPI_ITEMS: { label: string; key: keyof PeriodicReviewKpis; filterKey?: string; tone?: 'blue' | 'green' | 'amber' | 'red' }[] = [
  { label: 'Scheduled Reviews', key: 'scheduledReviews', filterKey: 'scheduled', tone: 'blue' },
  { label: 'Due This Month', key: 'dueThisMonth', filterKey: 'due_month', tone: 'amber' },
  { label: 'Overdue Reviews', key: 'overdueReviews', filterKey: 'overdue', tone: 'red' },
  { label: 'Completed Reviews', key: 'completedReviews', filterKey: 'completed', tone: 'green' },
  { label: 'Major Revisions', key: 'majorRevisions', tone: 'red' },
  { label: 'Minor Revisions', key: 'minorRevisions', tone: 'amber' },
  { label: 'Documents Retired', key: 'documentsRetired', tone: 'blue' },
  { label: 'Avg Review Duration (days)', key: 'averageReviewDurationDays', tone: 'green' },
];

export function PeriodicReviewManagementPage() {
  return (<Suspense fallback={<LoadingSkeleton rows={8} />}><PeriodicReviewManagementContent /></Suspense>);
}

function PeriodicReviewManagementContent() {
  const searchParams = useSearchParams();
  const viewedLogged = useRef(false);
  const [activeKpi, setActiveKpi] = useState<string | null>(null);
  const [completeRecord, setCompleteRecord] = useState<PeriodicReviewRecord | null>(null);

  const {
    records, paginatedRecords, metrics, charts, filters, setFilters,
    loading, refreshing, error, refresh, actor, page, setPage, totalPages, pagination,
    selectedIds, toggleSelect, toggleSelectAll, clearSelection,
    canExport, canManage, canBulk, isReadOnly, canView,
  } = usePeriodicReviewManagement();

  useEffect(() => {
    if (!viewedLogged.current && !loading && actor.id) {
      viewedLogged.current = true;
      void logPeriodicReviewDashboardViewed(actor);
    }
  }, [loading, actor.id, actor]);

  useEffect(() => {
    const kpi = searchParams.get('kpi');
    if (kpi && PRM_KPI_FILTER_MAP[kpi]) {
      setActiveKpi(kpi);
      setFilters((p) => ({ ...p, ...PRM_KPI_FILTER_MAP[kpi] }));
    }
  }, [searchParams, setFilters]);

  const handleExport = useCallback((format: 'csv' | 'excel' | 'print') => {
    if (!records.length) { toast.error('No records to export'); return; }
    if (format === 'csv') exportPeriodicReviewsCsv(records);
    else if (format === 'excel') exportPeriodicReviewsExcel(records);
    else window.print();
    void logPeriodicReviewExported(actor, format, records.length);
    toast.success('Export complete');
  }, [records, actor]);

  const handleStart = async (id: string) => {
    try {
      await startPeriodicReview(id, actor);
      toast.success('Review started');
      refresh(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to start review'); }
  };

  const handleComplete = async (input: CompleteReviewInput) => {
    if (!completeRecord) return;
    try {
      await completePeriodicReview(completeRecord.id, input, actor);
      toast.success('Review completed');
      setCompleteRecord(null);
      refresh(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to complete review'); }
  };

  const handleBulkSchedule = async () => {
    if (!selectedIds.length) { toast.error('Select reviews first'); return; }
    const dueDate = prompt('Enter new due date (YYYY-MM-DD):');
    if (!dueDate) return;
    const count = await bulkScheduleReviews(selectedIds, dueDate, actor);
    toast.success(`${count} review(s) rescheduled`);
    clearSelection();
    refresh(true);
  };

  const queueRecords = getUpcomingReviews(records).filter((r) =>
    ['Pending', 'Scheduled', 'In Progress', 'Overdue'].includes(r.status),
  );

  if (!canView) return <ErrorCard message="You do not have access to periodic review management." />;
  if (loading && !records.length) return <PrmSkeleton rows={8} />;
  if (error) return <ErrorCard message={error} onRetry={() => refresh()} />;

  return (
    <div className="space-y-6 animate-in fade-in print:space-y-4">
      <DmsPageHeader
        title="Periodic Review Management"
        description="Schedule, monitor, and document recurring GMP document reviews."
        trail={[{ label: 'Periodic Review Management' }]}
        actions={<>
          <Button variant="outline" size="sm" onClick={() => refresh(true)} disabled={refreshing}>
            <RefreshCw className={cn('h-4 w-4 mr-1', refreshing && 'animate-spin')} /> Refresh
          </Button>
          {canBulk && selectedIds.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => void handleBulkSchedule()}>
              <Calendar className="h-4 w-4 mr-1" /> Bulk Schedule ({selectedIds.length})
            </Button>
          )}
          {canExport && (<>
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')}><Download className="h-4 w-4 mr-1" /> CSV</Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('excel')}><Download className="h-4 w-4 mr-1" /> Excel</Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('print')}><Printer className="h-4 w-4 mr-1" /> Print</Button>
          </>)}
        </>}
      />

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Input placeholder="Search documents..." value={filters.search || ''} onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1); }} className="max-w-xs" />
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.status || ''} onChange={(e) => { setFilters({ ...filters, status: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Statuses</option>
              {REVIEW_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.department || ''} onChange={(e) => { setFilters({ ...filters, department: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Departments</option>
              {DMS_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.frequency || ''} onChange={(e) => { setFilters({ ...filters, frequency: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Frequencies</option>
              {REVIEW_FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.document_type || ''} onChange={(e) => { setFilters({ ...filters, document_type: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Document Types</option>
              {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {KPI_ITEMS.map((item) => item.filterKey ? (
          <button key={item.key} type="button" onClick={() => {
            const active = activeKpi === item.filterKey;
            setActiveKpi(active ? null : item.filterKey!);
            setFilters(active ? {} : PRM_KPI_FILTER_MAP[item.filterKey!] || {});
            setPage(1);
          }} className={cn('text-left', activeKpi === item.filterKey && 'ring-2 ring-emerald-500 rounded-lg')}>
            <KpiCard label={item.label} value={metrics[item.key]} tone={item.tone} />
          </button>
        ) : (
          <KpiCard key={item.key} label={item.label} value={metrics[item.key]} tone={item.tone} />
        ))}
      </div>

      <PrmCharts charts={charts} />

      {canManage && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Calendar className="h-5 w-5" /> Review Calendar</h2>
          <PeriodicReviewCalendar records={getUpcomingReviews(records).slice(0, 30)} />
        </div>
      )}

      {queueRecords.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Play className="h-5 w-5" /> Review Queue</h2>
          <ReviewScheduleTable
            records={queueRecords.slice(0, 6)}
            isReadOnly={isReadOnly}
            onStart={(id) => void handleStart(id)}
            onComplete={(id) => setCompleteRecord(records.find((r) => r.id === id) || null)}
          />
        </div>
      )}

      <Tabs defaultValue="upcoming" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="upcoming">Upcoming ({getUpcomingReviews(records).length})</TabsTrigger>
          <TabsTrigger value="overdue">Overdue ({getOverdueReviews(records).length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({getCompletedReviews(records).length})</TabsTrigger>
          <TabsTrigger value="decisions">Decisions ({getReviewDecisions(records).length})</TabsTrigger>
          <TabsTrigger value="revised">Recently Revised ({getRecentlyRevised(records).length})</TabsTrigger>
          <TabsTrigger value="next_month">Due Next Month ({getDueNextMonth(records).length})</TabsTrigger>
          <TabsTrigger value="all">All ({records.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card>
            <CardContent className="p-0">
              <PeriodicReviewTable records={paginatedRecords} selectedIds={selectedIds} toggleSelect={toggleSelect} toggleSelectAll={toggleSelectAll} isReadOnly={isReadOnly} />
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t">
                  <p className="text-sm text-muted-foreground">{(page - 1) * pagination.pageSize + 1}–{Math.min(page * pagination.pageSize, pagination.total)} of {pagination.total}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {[
          { v: 'upcoming', d: getUpcomingReviews(records) },
          { v: 'overdue', d: getOverdueReviews(records) },
          { v: 'completed', d: getCompletedReviews(records) },
          { v: 'decisions', d: getReviewDecisions(records) },
          { v: 'revised', d: getRecentlyRevised(records) },
          { v: 'next_month', d: getDueNextMonth(records) },
        ].map(({ v, d }) => (
          <TabsContent key={v} value={v}>
            <Card>
              <CardContent className="p-0">
                <PeriodicReviewTable records={d.slice(0, 20)} isReadOnly={isReadOnly} compact />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <DecisionWizard
        open={Boolean(completeRecord)}
        onOpenChange={(o) => { if (!o) setCompleteRecord(null); }}
        record={completeRecord}
        onComplete={(input) => void handleComplete(input)}
      />
    </div>
  );
}
