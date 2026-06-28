'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Plus, RefreshCw, Archive, LayoutGrid, List } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { DmsPageHeader } from '@/components/dms/dms-page-header';
import { DocumentMasterCharts } from '@/components/dms/document-master/document-master-charts';
import { FilterPanel } from '@/components/dms/document-master/filter-panel';
import { ExportMenu } from '@/components/dms/document-master/export-menu';
import { DocumentTable } from '@/components/dms/document-master/document-table';
import { DocumentCard } from '@/components/dms/document-master/document-card';
import { useDocumentMaster } from '@/hooks/use-document-master';
import {
  bulkArchiveDocuments,
  exportDocumentMasterCsv,
  exportDocumentMasterExcel,
  logDocumentMasterExported,
} from '@/lib/document-master-service';
import type { DocumentMasterKpis } from '@/lib/document-master-types';
import { toTableRow } from '@/lib/document-master-records';

const KPI_ITEMS: { label: string; key: keyof DocumentMasterKpis; tone?: 'blue' | 'green' | 'amber' | 'red' }[] = [
  { label: 'Total Documents', key: 'totalDocuments', tone: 'blue' },
  { label: 'Effective Documents', key: 'effectiveDocuments', tone: 'green' },
  { label: 'Draft Documents', key: 'draftDocuments', tone: 'blue' },
  { label: 'Pending Review', key: 'pendingReview', tone: 'amber' },
  { label: 'Pending Approval', key: 'pendingApproval', tone: 'amber' },
  { label: 'Expired Documents', key: 'expiredDocuments', tone: 'red' },
  { label: 'Due for Review', key: 'documentsDueForReview', tone: 'amber' },
  { label: 'Archived Documents', key: 'archivedDocuments', tone: 'blue' },
  { label: 'Obsolete Documents', key: 'obsoleteDocuments', tone: 'red' },
];

export function DocumentMasterPage() {
  const viewedLogged = useRef(false);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  const {
    data, filters, setFilters, loading, refreshing, error, refresh, actor,
    page, setPage, pageSize, pagination, selectedIds, toggleSelect, toggleSelectAll,
    clearSelection, favorites, canCreate, canBulk, canExport, isReadOnly, effectiveOnly, logViewed,
  } = useDocumentMaster();

  useEffect(() => {
    if (!viewedLogged.current && !loading && actor.id) {
      viewedLogged.current = true;
      void logViewed();
    }
  }, [loading, actor.id, logViewed]);

  const handleExportCsv = useCallback(() => {
    if (!data?.records.length) { toast.error('No documents to export'); return; }
    exportDocumentMasterCsv(data.records);
    void logDocumentMasterExported(actor, 'csv', data.records.length);
    toast.success('CSV exported');
  }, [data?.records, actor]);

  const handleExportExcel = useCallback(() => {
    if (!data?.records.length) { toast.error('No documents to export'); return; }
    exportDocumentMasterExcel(data.records);
    void logDocumentMasterExported(actor, 'excel', data.records.length);
    toast.success('Excel export downloaded');
  }, [data?.records, actor]);

  const handlePrint = useCallback(() => {
    if (!data?.records.length) { toast.error('No documents to print'); return; }
    void logDocumentMasterExported(actor, 'print', data.records.length);
    window.print();
  }, [data?.records, actor]);

  const handleBulkArchive = useCallback(async () => {
    if (!selectedIds.length) { toast.error('Select documents to archive'); return; }
    const reason = window.prompt('Reason for bulk archive:');
    if (!reason) return;
    try {
      const count = await bulkArchiveDocuments(selectedIds, reason, actor);
      toast.success(`Archived ${count} document(s)`);
      clearSelection();
      await refresh(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bulk archive failed');
    }
  }, [selectedIds, actor, clearSelection, refresh]);

  const favoriteIdSet = new Set(favorites.map((f) => f.id));

  if (loading && !data) return <LoadingSkeleton rows={8} />;

  return (
    <div className="space-y-6 animate-in fade-in">
      <DmsPageHeader
        title="Document Master"
        description="Central repository for all controlled GMP documents."
        trail={[{ label: 'Document Master' }]}
        actions={(
          <>
            <Button variant="outline" size="sm" onClick={() => refresh(true)} disabled={refreshing} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            {canExport && (
              <ExportMenu
                onExportCsv={handleExportCsv}
                onExportExcel={handleExportExcel}
                onPrint={handlePrint}
                disabled={!data?.records.length}
              />
            )}
            {canBulk && selectedIds.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleBulkArchive} className="gap-2">
                <Archive className="h-4 w-4" /> Archive ({selectedIds.length})
              </Button>
            )}
            {canCreate && (
              <Link href="/qms/dms/create">
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 gap-2">
                  <Plus className="h-4 w-4" /> Create Document
                </Button>
              </Link>
            )}
          </>
        )}
      />

      {effectiveOnly && (
        <Alert>
          <AlertTitle>Read-only access</AlertTitle>
          <AlertDescription>You can view effective documents only.</AlertDescription>
        </Alert>
      )}

      {isReadOnly && !effectiveOnly && (
        <Alert>
          <AlertTitle>Auditor access</AlertTitle>
          <AlertDescription>Read-only mode — export and view actions are available.</AlertDescription>
        </Alert>
      )}

      {error && <ErrorCard message={error} onRetry={() => refresh()} />}

      {data && (
        <>
          <FilterPanel filters={filters} onChange={setFilters} options={data.filterOptions} />

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-9 gap-3">
            {KPI_ITEMS.map((kpi) => (
              <KpiCard
                key={kpi.key}
                label={kpi.label}
                value={data.kpis[kpi.key]}
                tone={kpi.tone}
              />
            ))}
          </div>

          <DocumentMasterCharts charts={data.charts} />

          <Tabs defaultValue="all" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="all">All Documents</TabsTrigger>
                <TabsTrigger value="recent">Recent</TabsTrigger>
                <TabsTrigger value="pending-review">Pending Reviews</TabsTrigger>
                <TabsTrigger value="pending-approval">Pending Approvals</TabsTrigger>
                <TabsTrigger value="updated">Recently Updated</TabsTrigger>
                <TabsTrigger value="expired">Expired</TabsTrigger>
                <TabsTrigger value="review-due">Due for Review</TabsTrigger>
                {favorites.length > 0 && <TabsTrigger value="favorites">Favorites</TabsTrigger>}
              </TabsList>
              <div className="flex gap-1">
                <Button variant={viewMode === 'table' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('table')}>
                  <List className="h-4 w-4" />
                </Button>
                <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('grid')}>
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <TabsContent value="all">
              <DocumentListSection
                title="Document Registry"
                viewMode={viewMode}
                rows={pagination.rows.map(toTableRow)}
                records={pagination.rows}
                selectable={canBulk}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onToggleSelectAll={toggleSelectAll}
                favoriteIds={favoriteIdSet}
                page={page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                onPageChange={setPage}
              />
            </TabsContent>

            {([
              ['recent', data.tables.recentDocuments, 'Recent Documents'],
              ['pending-review', data.tables.pendingReviews, 'Pending Reviews'],
              ['pending-approval', data.tables.pendingApprovals, 'Pending Approvals'],
              ['updated', data.tables.recentlyUpdated, 'Recently Updated'],
              ['expired', data.tables.expiredDocuments, 'Expired Documents'],
              ['review-due', data.tables.documentsDueForReview, 'Documents Due for Review'],
            ] as const).map(([tab, rows, title]) => (
              <TabsContent key={tab} value={tab}>
                <Card>
                  <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <DocumentTable rows={rows} showFavorite favoriteIds={favoriteIdSet} />
                  </CardContent>
                </Card>
              </TabsContent>
            ))}

            {favorites.length > 0 && (
              <TabsContent value="favorites">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {favorites.map((r) => <DocumentCard key={r.id} record={r} />)}
                </div>
              </TabsContent>
            )}
          </Tabs>
        </>
      )}
    </div>
  );
}

function DocumentListSection({
  title, viewMode, rows, records, selectable, selectedIds, onToggleSelect, onToggleSelectAll,
  favoriteIds, page, totalPages, total, onPageChange,
}: {
  title: string;
  viewMode: 'table' | 'grid';
  rows: Parameters<typeof DocumentTable>[0]['rows'];
  records: import('@/lib/document-master-types').DocumentMasterRecord[];
  selectable?: boolean;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: (ids: string[]) => void;
  favoriteIds?: Set<string>;
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        <span className="text-sm text-muted-foreground">{total} document(s)</span>
      </CardHeader>
      <CardContent className={viewMode === 'table' ? 'p-0' : 'pt-0'}>
        {viewMode === 'table' ? (
          <DocumentTable
            rows={rows}
            selectable={selectable}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
            onToggleSelectAll={onToggleSelectAll}
            showFavorite
            favoriteIds={favoriteIds}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {records.map((r) => <DocumentCard key={r.id} record={r} />)}
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
