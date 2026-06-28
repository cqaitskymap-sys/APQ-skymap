'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Download, Eye, RefreshCw, Printer, Archive } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { DmsPageHeader } from '@/components/dms/dms-page-header';
import { useDocumentLifecycle } from '@/hooks/use-document-lifecycle';
import { LifecycleCharts } from '@/components/document-lifecycle/lifecycle-charts';
import {
  StageBadge, StatusBadge, WorkflowProgress, ReviewCalendar, LoadingSkeleton as LifecycleSkeleton,
} from '@/components/document-lifecycle/lifecycle-ui';
import {
  exportLifecycleCsv, bulkLifecycleAction, logLifecycleExported,
} from '@/lib/document-lifecycle-service';
import type { DocumentLifecycleKpis } from '@/lib/document-lifecycle-types';
import {
  getAwaitingReview, getPendingApprovals, getUpcomingEffective,
  getReviewDueDocuments, getArchivedDocuments, getObsoleteDocuments,
  getRecentRevisions, KPI_FILTER_MAP,
} from '@/lib/document-lifecycle-records';
import { DMS_DEPARTMENTS } from '@/lib/dms-types';
import { cn } from '@/lib/utils';

const KPI_ITEMS: { label: string; key: keyof DocumentLifecycleKpis; filterKey?: string; tone?: 'blue' | 'green' | 'amber' | 'red' }[] = [
  { label: 'Total Documents', key: 'totalDocuments', tone: 'blue' },
  { label: 'Draft', key: 'draft', filterKey: 'draft' },
  { label: 'Under Review', key: 'underReview', filterKey: 'under_review', tone: 'amber' },
  { label: 'Pending Approval', key: 'pendingApproval', filterKey: 'pending_approval', tone: 'amber' },
  { label: 'Effective', key: 'effective', filterKey: 'effective', tone: 'green' },
  { label: 'Scheduled', key: 'scheduled', filterKey: 'scheduled', tone: 'blue' },
  { label: 'Review Due', key: 'reviewDue', filterKey: 'review_due', tone: 'amber' },
  { label: 'Overdue Review', key: 'overdueReview', filterKey: 'overdue', tone: 'red' },
  { label: 'Revision Required', key: 'revisionRequired', filterKey: 'revision_required', tone: 'red' },
  { label: 'Archived', key: 'archived', filterKey: 'archived' },
  { label: 'Obsolete', key: 'obsolete', filterKey: 'obsolete', tone: 'red' },
  { label: 'Retired', key: 'retired', filterKey: 'retired' },
];

export function DocumentLifecyclePage() {
  return (
    <Suspense fallback={<LoadingSkeleton rows={8} />}>
      <DocumentLifecycleContent />
    </Suspense>
  );
}

function DocumentLifecycleContent() {
  const searchParams = useSearchParams();
  const viewedLogged = useRef(false);
  const [activeKpi, setActiveKpi] = useState<string | null>(null);

  const {
    records, paginatedRecords, metrics, charts, filters, setFilters,
    loading, refreshing, error, refresh, actor, page, setPage, totalPages,
    pagination, selectedIds, toggleSelect, toggleSelectAll, clearSelection,
    logViewed, canExport, canBulk, isReadOnly,
  } = useDocumentLifecycle();

  useEffect(() => {
    if (!viewedLogged.current && !loading && actor.id) {
      viewedLogged.current = true;
      void logViewed();
    }
  }, [loading, actor.id, logViewed]);

  useEffect(() => {
    const kpi = searchParams.get('kpi');
    if (kpi && KPI_FILTER_MAP[kpi]) {
      setActiveKpi(kpi);
      setFilters((prev) => ({ ...prev, ...KPI_FILTER_MAP[kpi] }));
    }
  }, [searchParams, setFilters]);

  const handleKpiClick = (filterKey?: string) => {
    if (!filterKey) return;
    const isActive = activeKpi === filterKey;
    if (isActive) {
      setActiveKpi(null);
      setFilters({});
    } else {
      setActiveKpi(filterKey);
      setFilters(KPI_FILTER_MAP[filterKey] || {});
    }
    setPage(1);
  };

  const handleExport = useCallback(() => {
    if (!records.length) { toast.error('No records to export'); return; }
    exportLifecycleCsv(records);
    void logLifecycleExported(actor, 'csv', records.length);
    toast.success('Lifecycle data exported');
  }, [records, actor]);

  const handlePrint = useCallback(() => {
    if (!records.length) { toast.error('No records to print'); return; }
    void logLifecycleExported(actor, 'print', records.length);
    window.print();
  }, [records, actor]);

  const handleBulkArchive = useCallback(async () => {
    if (!selectedIds.length) { toast.error('Select documents first'); return; }
    const reason = window.prompt('Reason for bulk archive:');
    if (!reason) return;
    try {
      const count = await bulkLifecycleAction(selectedIds, 'archive', reason, actor);
      toast.success(`Archived ${count} document(s)`);
      clearSelection();
      await refresh(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bulk action failed');
    }
  }, [selectedIds, actor, clearSelection, refresh]);

  const reviewCalendar = getReviewDueDocuments(records).map((r) => ({
    date: r.review_due_date || 'TBD',
    document_number: r.document_number,
    title: r.document_title,
  }));

  if (loading && !records.length) return <LifecycleSkeleton rows={8} />;
  if (error) return <ErrorCard message={error} onRetry={() => refresh()} />;

  return (
    <div className="space-y-6 animate-in fade-in print:space-y-4">
      <DmsPageHeader
        title="Document Lifecycle Management"
        description="Manage the complete GMP document lifecycle from creation to retirement."
        trail={[{ label: 'Document Lifecycle' }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => refresh(true)} disabled={refreshing}>
              <RefreshCw className={cn('h-4 w-4 mr-1', refreshing && 'animate-spin')} /> Refresh
            </Button>
            {canExport && (
              <>
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="h-4 w-4 mr-1" /> Export
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-1" /> Print
                </Button>
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

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="Search documents..."
              value={filters.search || ''}
              onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1); }}
              className="max-w-xs"
            />
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={filters.department || ''}
              onChange={(e) => { setFilters({ ...filters, department: e.target.value || undefined }); setPage(1); }}
            >
              <option value="">All Departments</option>
              {DMS_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={filters.stage || ''}
              onChange={(e) => { setFilters({ ...filters, stage: e.target.value || undefined }); setPage(1); }}
            >
              <option value="">All Stages</option>
              {['Draft', 'Department Review', 'QA Review', 'Pending Approval', 'Approved', 'Effective', 'Periodic Review', 'Revision Required', 'Archived', 'Obsolete', 'Retired'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {(filters.search || filters.department || filters.stage || activeKpi) && (
              <Button variant="ghost" size="sm" onClick={() => { setFilters({}); setActiveKpi(null); setPage(1); }}>
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {KPI_ITEMS.map((item) => (
          item.filterKey ? (
            <button
              key={item.key}
              type="button"
              onClick={() => handleKpiClick(item.filterKey)}
              className={cn('text-left transition-opacity', activeKpi === item.filterKey && 'ring-2 ring-blue-500 rounded-lg')}
            >
              <KpiCard label={item.label} value={metrics[item.key]} tone={item.tone} />
            </button>
          ) : (
            <KpiCard key={item.key} label={item.label} value={metrics[item.key]} tone={item.tone} />
          )
        ))}
      </div>

      {/* Charts */}
      <LifecycleCharts charts={charts} />

      {/* Tables */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="all">All Documents ({records.length})</TabsTrigger>
          <TabsTrigger value="review">Awaiting Review ({getAwaitingReview(records).length})</TabsTrigger>
          <TabsTrigger value="approval">Pending Approvals ({getPendingApprovals(records).length})</TabsTrigger>
          <TabsTrigger value="effective">Upcoming Effective ({getUpcomingEffective(records).length})</TabsTrigger>
          <TabsTrigger value="review-due">Review Due ({getReviewDueDocuments(records).length})</TabsTrigger>
          <TabsTrigger value="archived">Archived ({getArchivedDocuments(records).length})</TabsTrigger>
          <TabsTrigger value="obsolete">Obsolete ({getObsoleteDocuments(records).length})</TabsTrigger>
          <TabsTrigger value="revisions">Recent Revisions ({getRecentRevisions(records).length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <LifecycleTable
            records={paginatedRecords}
            allRecords={records}
            selectedIds={selectedIds}
            toggleSelect={toggleSelect}
            toggleSelectAll={toggleSelectAll}
            isReadOnly={isReadOnly}
            page={page}
            totalPages={totalPages}
            setPage={setPage}
            pagination={pagination}
          />
        </TabsContent>

        {[
          { value: 'review', data: getAwaitingReview(records) },
          { value: 'approval', data: getPendingApprovals(records) },
          { value: 'effective', data: getUpcomingEffective(records) },
          { value: 'review-due', data: getReviewDueDocuments(records) },
          { value: 'archived', data: getArchivedDocuments(records) },
          { value: 'obsolete', data: getObsoleteDocuments(records) },
          { value: 'revisions', data: getRecentRevisions(records) },
        ].map(({ value, data }) => (
          <TabsContent key={value} value={value}>
            <LifecycleTable records={data.slice(0, 20)} allRecords={data} isReadOnly={isReadOnly} compact />
          </TabsContent>
        ))}
      </Tabs>

      {/* Review Calendar */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Review Calendar</CardTitle>
          </CardHeader>
          <CardContent>
            <ReviewCalendar dates={reviewCalendar} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Sample Workflow Progress</CardTitle>
          </CardHeader>
          <CardContent>
            {records[0] ? (
              <WorkflowProgress currentStage={records[0].current_stage} />
            ) : (
              <p className="text-sm text-muted-foreground">No documents to display workflow.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface LifecycleTableProps {
  records: import('@/lib/document-lifecycle-types').DocumentLifecycleRecord[];
  allRecords: import('@/lib/document-lifecycle-types').DocumentLifecycleRecord[];
  selectedIds?: string[];
  toggleSelect?: (id: string) => void;
  toggleSelectAll?: () => void;
  isReadOnly: boolean;
  page?: number;
  totalPages?: number;
  setPage?: (p: number) => void;
  pagination?: { page: number; pageSize: number; total: number; totalPages: number };
  compact?: boolean;
}

function LifecycleTable({
  records, selectedIds, toggleSelect, toggleSelectAll, isReadOnly,
  page, totalPages, setPage, pagination, compact,
}: LifecycleTableProps) {
  if (!records.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No documents match the current filters.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {!isReadOnly && toggleSelect && (
                  <th className="p-3 w-10">
                    <input type="checkbox" onChange={toggleSelectAll} className="rounded" />
                  </th>
                )}
                <th className="p-3 text-left font-medium">Document #</th>
                <th className="p-3 text-left font-medium">Title</th>
                <th className="p-3 text-left font-medium hidden md:table-cell">Version</th>
                <th className="p-3 text-left font-medium">Stage</th>
                <th className="p-3 text-left font-medium hidden lg:table-cell">Owner</th>
                <th className="p-3 text-left font-medium hidden lg:table-cell">Department</th>
                <th className="p-3 text-left font-medium hidden xl:table-cell">Effective</th>
                <th className="p-3 text-left font-medium hidden xl:table-cell">Review Due</th>
                <th className="p-3 text-left font-medium hidden md:table-cell">Status</th>
                <th className="p-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b hover:bg-muted/30 transition-colors">
                  {!isReadOnly && toggleSelect && (
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedIds?.includes(r.id)}
                        onChange={() => toggleSelect(r.id)}
                        className="rounded"
                      />
                    </td>
                  )}
                  <td className="p-3 font-mono text-xs">{r.document_number}</td>
                  <td className="p-3 max-w-[200px] truncate">{r.document_title}</td>
                  <td className="p-3 hidden md:table-cell">{r.current_version}</td>
                  <td className="p-3"><StageBadge stage={r.current_stage} /></td>
                  <td className="p-3 hidden lg:table-cell text-muted-foreground">{r.current_owner_name}</td>
                  <td className="p-3 hidden lg:table-cell text-muted-foreground">{r.department}</td>
                  <td className="p-3 hidden xl:table-cell text-muted-foreground">{r.effective_date || '—'}</td>
                  <td className="p-3 hidden xl:table-cell text-muted-foreground">{r.review_due_date || '—'}</td>
                  <td className="p-3 hidden md:table-cell"><StatusBadge status={r.workflow_status} /></td>
                  <td className="p-3">
                    <Link href={`/qms/dms/${r.document_id}`} className="text-blue-600 hover:text-blue-800">
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
              Showing {(page! - 1) * pagination.pageSize + 1}–{Math.min(page! * pagination.pageSize, pagination.total)} of {pagination.total}
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
