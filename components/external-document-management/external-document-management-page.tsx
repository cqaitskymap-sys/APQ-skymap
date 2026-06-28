'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, RefreshCw, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { DmsPageHeader } from '@/components/dms/dms-page-header';
import { useExternalDocumentManagement } from '@/hooks/use-external-document-management';
import { EdmCharts } from '@/components/external-document-management/edm-charts';
import {
  ExternalDocumentTable, DocumentSourceCard, LinkedDocumentViewer, VersionHistory,
  ReviewCalendar, RegulatoryLibrary, LoadingSkeleton as EdmSkeleton,
} from '@/components/external-document-management/edm-ui';
import {
  exportExternalDocumentsCsv, exportExternalDocumentsExcel, logExternalExported,
  logExternalDashboardViewed, submitForReview, approveExternalDocument, getDocumentVersions,
} from '@/lib/external-document-service';
import type { ExternalDocumentKpis, ExternalDocumentRecord } from '@/lib/external-document-types';
import { EXTERNAL_DOC_STATUSES, EXTERNAL_DOC_TYPES, EXTERNAL_DOC_CATEGORIES } from '@/lib/external-document-types';
import {
  EDM_KPI_FILTER_MAP, getRecentlyAdded, getPendingReviewDocs, getUpcomingReviews,
  getExpiringDocs, getSupplierDocs, getRegulatoryDocs,
} from '@/lib/external-document-records';
import { DMS_DEPARTMENTS } from '@/lib/dms-types';
import { cn } from '@/lib/utils';

const KPI_ITEMS: { label: string; key: keyof ExternalDocumentKpis; filterKey?: string; tone?: 'blue' | 'green' | 'amber' | 'red' }[] = [
  { label: 'Total External Documents', key: 'totalDocuments', filterKey: 'total', tone: 'blue' },
  { label: 'Approved for Use', key: 'approvedForUse', filterKey: 'approved', tone: 'green' },
  { label: 'Pending Reviews', key: 'pendingReviews', filterKey: 'review', tone: 'amber' },
  { label: 'Expiring Soon', key: 'expiringSoon', filterKey: 'expiring', tone: 'amber' },
  { label: 'Superseded', key: 'supersededDocuments', filterKey: 'superseded', tone: 'red' },
  { label: 'Supplier Documents', key: 'supplierDocuments', filterKey: 'supplier', tone: 'blue' },
  { label: 'Regulatory Documents', key: 'regulatoryDocuments', filterKey: 'regulatory', tone: 'green' },
  { label: 'Standards', key: 'standardsDocuments', filterKey: 'standards', tone: 'blue' },
];

export function ExternalDocumentManagementPage() {
  return (<Suspense fallback={<LoadingSkeleton rows={8} />}><ExternalDocumentContent /></Suspense>);
}

function ExternalDocumentContent() {
  const searchParams = useSearchParams();
  const viewedLogged = useRef(false);
  const [activeKpi, setActiveKpi] = useState<string | null>(null);
  const [detailRecord, setDetailRecord] = useState<ExternalDocumentRecord | null>(null);
  const [versions, setVersions] = useState<Array<{ id: string; revision_number?: string; revision_date?: string; change_summary?: string }>>([]);

  const {
    records, paginatedRecords, metrics, charts, filters, setFilters,
    loading, refreshing, error, refresh, actor, page, setPage, totalPages, pagination,
    selectedIds, toggleSelect, toggleSelectAll,
    canExport, canManage, canApprove, isReadOnly, canView,
  } = useExternalDocumentManagement();

  useEffect(() => {
    if (!viewedLogged.current && !loading && actor.id) {
      viewedLogged.current = true;
      void logExternalDashboardViewed(actor);
    }
  }, [loading, actor.id, actor]);

  useEffect(() => {
    const kpi = searchParams.get('kpi');
    if (kpi && EDM_KPI_FILTER_MAP[kpi]) {
      setActiveKpi(kpi);
      setFilters((p) => ({ ...p, ...EDM_KPI_FILTER_MAP[kpi] }));
    }
  }, [searchParams, setFilters]);

  useEffect(() => {
    if (detailRecord) {
      void getDocumentVersions(detailRecord.id).then(setVersions);
    } else {
      setVersions([]);
    }
  }, [detailRecord]);

  const handleExport = useCallback((format: 'csv' | 'excel' | 'print') => {
    if (!records.length) { toast.error('No records to export'); return; }
    if (format === 'csv') exportExternalDocumentsCsv(records);
    else if (format === 'excel') exportExternalDocumentsExcel(records);
    else window.print();
    void logExternalExported(actor, format, records.length);
    toast.success('Export complete');
  }, [records, actor]);

  const handleSubmitReview = async (id: string) => {
    try {
      await submitForReview(id, actor);
      toast.success('Submitted for review');
      refresh(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Submit failed'); }
  };

  const handleApprove = async (id: string) => {
    try {
      await approveExternalDocument(id, { signature_meaning: 'I approve this external document for use', comments: '' }, actor);
      toast.success('Document approved for use');
      refresh(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Approval failed'); }
  };

  if (!canView) return <ErrorCard message="You do not have access to external document management." />;
  if (loading && !records.length) return <EdmSkeleton rows={8} />;
  if (error) return <ErrorCard message={error} onRetry={() => refresh()} />;

  const recentDocs = getRecentlyAdded(records).slice(0, 4);

  return (
    <div className="space-y-6 animate-in fade-in print:space-y-4">
      <DmsPageHeader
        title="External Document Management"
        description="Manage externally controlled GMP documents with complete lifecycle tracking and compliance."
        trail={[{ label: 'External Document Management' }]}
        actions={<>
          <Button variant="outline" size="sm" onClick={() => refresh(true)} disabled={refreshing}>
            <RefreshCw className={cn('h-4 w-4 mr-1', refreshing && 'animate-spin')} /> Refresh
          </Button>
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
            <Input placeholder="Search documents..." value={filters.search || ''}
              onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1); }} className="max-w-xs" />
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.status || ''}
              onChange={(e) => { setFilters({ ...filters, status: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Statuses</option>
              {EXTERNAL_DOC_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.document_type || ''}
              onChange={(e) => { setFilters({ ...filters, document_type: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Types</option>
              {EXTERNAL_DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.document_category || ''}
              onChange={(e) => { setFilters({ ...filters, document_category: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Categories</option>
              {EXTERNAL_DOC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.department || ''}
              onChange={(e) => { setFilters({ ...filters, department: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Departments</option>
              {DMS_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {KPI_ITEMS.map((item) => item.filterKey ? (
          <button key={item.key} type="button" onClick={() => {
            const active = activeKpi === item.filterKey;
            setActiveKpi(active ? null : item.filterKey!);
            setFilters(active ? {} : EDM_KPI_FILTER_MAP[item.filterKey!] || {});
            setPage(1);
          }} className={cn('text-left', activeKpi === item.filterKey && 'ring-2 ring-blue-500 rounded-lg')}>
            <KpiCard label={item.label} value={metrics[item.key]} tone={item.tone} />
          </button>
        ) : (
          <KpiCard key={item.key} label={item.label} value={metrics[item.key]} tone={item.tone} />
        ))}
      </div>

      <EdmCharts charts={charts} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Review Calendar</CardTitle></CardHeader>
          <CardContent><ReviewCalendar records={records} /></CardContent>
        </Card>
        <div className="space-y-3">
          {recentDocs.map((r) => <DocumentSourceCard key={r.id} record={r} />)}
        </div>
      </div>

      {detailRecord && (
        <Card>
          <CardContent className="pt-4 space-y-4">
            <div className="flex justify-between items-start">
              <h3 className="font-semibold">{detailRecord.title}</h3>
              <Button variant="ghost" size="sm" onClick={() => setDetailRecord(null)}>Close</Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium mb-2">Version History</p>
                <VersionHistory versions={versions} />
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Linked Internal Documents</p>
                <LinkedDocumentViewer links={detailRecord.linked_internal_documents} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Source: {detailRecord.source_organization} · {detailRecord.source_url || 'No URL'} · Owner: {detailRecord.owner_name}
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="recent" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="recent">Recently Added ({getRecentlyAdded(records).length})</TabsTrigger>
          <TabsTrigger value="review">Pending Reviews ({getPendingReviewDocs(records).length})</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming Reviews ({getUpcomingReviews(records).length})</TabsTrigger>
          <TabsTrigger value="expiring">Expiring ({getExpiringDocs(records).length})</TabsTrigger>
          <TabsTrigger value="supplier">Supplier ({getSupplierDocs(records).length})</TabsTrigger>
          <TabsTrigger value="regulatory">Regulatory ({getRegulatoryDocs(records).length})</TabsTrigger>
          <TabsTrigger value="all">All ({records.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="recent">
          <Card><CardContent className="p-0">
            <ExternalDocumentTable records={getRecentlyAdded(records).slice(0, 20)} selectedIds={[]} toggleSelect={() => {}} toggleSelectAll={() => {}} isReadOnly onDetail={setDetailRecord} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="review">
          <Card><CardContent className="p-0">
            <ExternalDocumentTable records={getPendingReviewDocs(records)} selectedIds={selectedIds} toggleSelect={toggleSelect} toggleSelectAll={toggleSelectAll} isReadOnly={isReadOnly}
              onDetail={setDetailRecord} onApprove={canApprove ? handleApprove : undefined} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="upcoming">
          <Card><CardContent className="p-0">
            <ExternalDocumentTable records={getUpcomingReviews(records)} selectedIds={[]} toggleSelect={() => {}} toggleSelectAll={() => {}} isReadOnly onDetail={setDetailRecord} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="expiring">
          <Card><CardContent className="p-0">
            <ExternalDocumentTable records={getExpiringDocs(records)} selectedIds={[]} toggleSelect={() => {}} toggleSelectAll={() => {}} isReadOnly onDetail={setDetailRecord} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="supplier">
          <Card><CardContent className="pt-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {getSupplierDocs(records).map((r) => (
                <button key={r.id} type="button" className="text-left" onClick={() => setDetailRecord(r)}>
                  <DocumentSourceCard record={r} />
                </button>
              ))}
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="regulatory">
          <Card><CardContent className="pt-4">
            <RegulatoryLibrary records={getRegulatoryDocs(records)} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="all">
          <Card><CardContent className="p-0">
            <ExternalDocumentTable records={paginatedRecords} selectedIds={selectedIds} toggleSelect={toggleSelect} toggleSelectAll={toggleSelectAll} isReadOnly={isReadOnly}
              onDetail={setDetailRecord} onReview={canManage ? handleSubmitReview : undefined} onApprove={canApprove ? handleApprove : undefined} />
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t">
                <p className="text-sm text-muted-foreground">
                  {(page - 1) * pagination.pageSize + 1}–{Math.min(page * pagination.pageSize, pagination.total)} of {pagination.total}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</Button>
                </div>
              </div>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
