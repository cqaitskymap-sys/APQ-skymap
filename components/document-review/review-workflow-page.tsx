'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Download, RefreshCw, Printer, Bell, AlertTriangle, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { DmsPageHeader } from '@/components/dms/dms-page-header';
import { useDocumentReview } from '@/hooks/use-document-review';
import { ReviewCharts } from '@/components/document-review/review-charts';
import {
  ReviewTable, ReviewInbox, LoadingSkeleton as ReviewSkeleton,
} from '@/components/document-review/review-ui';
import {
  exportReviewsCsv, exportReviewsExcel, logReviewExported, logReviewDashboardViewed,
  sendReviewReminders, startReview, completeReview,
} from '@/lib/document-review-service';
import type { ReviewKpis } from '@/lib/document-review-types';
import { REVIEW_MODES } from '@/lib/document-review-types';
import {
  getPendingReviews, getOverdueReviews, getRecentCompleted, getRevisionRequests,
  getReviewerQueue, getReviewHistory, REVIEW_KPI_FILTER_MAP,
} from '@/lib/document-review-records';
import { DMS_DEPARTMENTS, DOCUMENT_TYPES } from '@/lib/dms-types';
import { cn } from '@/lib/utils';

const KPI_ITEMS: { label: string; key: keyof ReviewKpis; filterKey?: string; tone?: 'blue' | 'green' | 'amber' | 'red' }[] = [
  { label: 'Pending Reviews', key: 'pendingReviews', filterKey: 'pending', tone: 'amber' },
  { label: 'Reviews in Progress', key: 'inProgress', filterKey: 'in_progress', tone: 'blue' },
  { label: 'Completed Reviews', key: 'completedReviews', filterKey: 'completed', tone: 'green' },
  { label: 'Overdue Reviews', key: 'overdueReviews', filterKey: 'overdue', tone: 'red' },
  { label: 'Revision Requests', key: 'revisionRequests', filterKey: 'revision', tone: 'amber' },
  { label: 'Avg Review Time (days)', key: 'averageReviewTimeDays' },
  { label: 'SLA Compliance %', key: 'slaCompliancePct', tone: 'green' },
  { label: 'Department Queue', key: 'departmentQueue' },
];

export function DocumentReviewWorkflowPage() {
  return (<Suspense fallback={<LoadingSkeleton rows={8} />}><DocumentReviewWorkflowContent /></Suspense>);
}

function DocumentReviewWorkflowContent() {
  const searchParams = useSearchParams();
  const viewedLogged = useRef(false);
  const [activeKpi, setActiveKpi] = useState<string | null>(null);
  const {
    records, paginatedRecords, metrics, charts, filters, setFilters,
    loading, refreshing, error, refresh, actor, page, setPage, totalPages, pagination,
    selectedIds, toggleSelect, toggleSelectAll, clearSelection,
    canExport, canComplete, canDesign, isReadOnly, canView, assignedOnly,
  } = useDocumentReview();

  useEffect(() => {
    if (!viewedLogged.current && !loading && actor.id) {
      viewedLogged.current = true;
      void logReviewDashboardViewed(actor);
    }
  }, [loading, actor.id, actor]);

  useEffect(() => {
    const kpi = searchParams.get('kpi');
    if (kpi && REVIEW_KPI_FILTER_MAP[kpi]) {
      setActiveKpi(kpi);
      setFilters((p) => ({ ...p, ...REVIEW_KPI_FILTER_MAP[kpi] }));
    }
  }, [searchParams, setFilters]);

  const handleExport = useCallback((format: 'csv' | 'excel' | 'print') => {
    if (!records.length) { toast.error('No reviews to export'); return; }
    if (format === 'csv') exportReviewsCsv(records);
    else if (format === 'excel') exportReviewsExcel(records);
    else window.print();
    void logReviewExported(actor, format, records.length);
    toast.success('Export complete');
  }, [records, actor]);

  const inboxRecords = getReviewerQueue(records, assignedOnly ? actor.id : undefined);

  const handleInboxAction = async (id: string, action: 'start' | 'complete') => {
    try {
      if (action === 'start') {
        await startReview(id, actor);
        toast.success('Review started');
      } else {
        const comments = window.prompt('Review comments (optional):') || '';
        const decision = window.prompt('Decision (Approved / Approved with Comments / Revision Required / Rejected):', 'Approved');
        if (!decision) return;
        await completeReview(id, { decision: decision as 'Approved', comments }, actor);
        toast.success('Review completed');
      }
      refresh(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Action failed'); }
  };

  if (!canView) return <ErrorCard message="You do not have access to document reviews." />;
  if (loading && !records.length) return <ReviewSkeleton rows={8} />;
  if (error) return <ErrorCard message={error} onRetry={() => refresh()} />;

  return (
    <div className="space-y-6 animate-in fade-in print:space-y-4">
      <DmsPageHeader
        title="Document Review Workflow"
        description="Manage GMP document reviews with configurable workflows and complete traceability."
        trail={[{ label: 'Review Workflow' }]}
        actions={<>
          {canDesign && (
            <Button size="sm" variant="outline" asChild>
              <Link href="/qms/documents/review-workflow/workflows"><Settings className="h-4 w-4 mr-1" /> Workflow Designer</Link>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => refresh(true)} disabled={refreshing}>
            <RefreshCw className={cn('h-4 w-4 mr-1', refreshing && 'animate-spin')} /> Refresh
          </Button>
          {canExport && (<>
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')}><Download className="h-4 w-4 mr-1" /> CSV</Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('excel')}><Download className="h-4 w-4 mr-1" /> Excel</Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('print')}><Printer className="h-4 w-4 mr-1" /> Print</Button>
          </>)}
          {selectedIds.length > 0 && (
            <Button variant="outline" size="sm" onClick={async () => {
              const c = await sendReviewReminders(selectedIds, actor);
              toast.success(`Sent ${c} reminder(s)`);
              clearSelection();
            }}><Bell className="h-4 w-4 mr-1" /> Remind ({selectedIds.length})</Button>
          )}
        </>}
      />

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Input placeholder="Search reviews..." value={filters.search || ''} onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1); }} className="max-w-xs" />
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.status || ''} onChange={(e) => { setFilters({ ...filters, status: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Statuses</option>
              {['Pending Review', 'Under Review', 'Completed', 'Returned for Revision', 'Cancelled', 'Expired'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.review_mode || ''} onChange={(e) => { setFilters({ ...filters, review_mode: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Modes</option>
              {REVIEW_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.department || ''} onChange={(e) => { setFilters({ ...filters, department: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Departments</option>
              {DMS_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
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
            setFilters(active ? {} : REVIEW_KPI_FILTER_MAP[item.filterKey!] || {});
            setPage(1);
          }} className={cn('text-left', activeKpi === item.filterKey && 'ring-2 ring-blue-500 rounded-lg')}>
            <KpiCard label={item.label} value={metrics[item.key]} tone={item.tone} />
          </button>
        ) : (
          <KpiCard key={item.key} label={item.label} value={metrics[item.key]} tone={item.tone} />
        ))}
      </div>

      <ReviewCharts charts={charts} />

      {canComplete && inboxRecords.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Bell className="h-5 w-5" /> My Review Inbox</h2>
          <ReviewInbox records={inboxRecords.slice(0, 6)} onAction={(id, action) => void handleInboxAction(id, action)} />
        </div>
      )}

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="pending">Pending ({getPendingReviews(records).length})</TabsTrigger>
          <TabsTrigger value="overdue">Overdue ({getOverdueReviews(records).length})</TabsTrigger>
          <TabsTrigger value="completed">Recent Completed ({getRecentCompleted(records).length})</TabsTrigger>
          <TabsTrigger value="revision">Revision Requests ({getRevisionRequests(records).length})</TabsTrigger>
          <TabsTrigger value="queue">Reviewer Queue ({getReviewerQueue(records).length})</TabsTrigger>
          <TabsTrigger value="history">Review History ({records.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          <Card>
            <CardContent className="p-0">
              <ReviewTable records={paginatedRecords} selectedIds={selectedIds} toggleSelect={toggleSelect} toggleSelectAll={toggleSelectAll} isReadOnly={isReadOnly} />
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
          { v: 'pending', d: getPendingReviews(records) },
          { v: 'overdue', d: getOverdueReviews(records) },
          { v: 'completed', d: getRecentCompleted(records) },
          { v: 'revision', d: getRevisionRequests(records) },
          { v: 'queue', d: getReviewerQueue(records) },
        ].map(({ v, d }) => (
          <TabsContent key={v} value={v}>
            <Card>
              <CardContent className="p-0">
                {v === 'overdue' && d.length > 0 && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/20 border-b flex items-center gap-2 text-sm text-red-700">
                    <AlertTriangle className="h-4 w-4" /> {d.length} overdue review(s)
                  </div>
                )}
                <ReviewTable records={d.slice(0, 20)} isReadOnly={isReadOnly} compact />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
