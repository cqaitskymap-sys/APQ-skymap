'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Download, RefreshCw, Printer, Plus, GitCompare, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { DmsPageHeader } from '@/components/dms/dms-page-header';
import { useDocumentVersionControl } from '@/hooks/use-document-version-control';
import { VersionControlCharts } from '@/components/document-version-control/version-control-charts';
import {
  RevisionHistoryTable, VersionTimeline, VersionComparison, LoadingSkeleton as VcSkeleton,
} from '@/components/document-version-control/version-control-ui';
import {
  exportVersionsCsv, exportVersionsExcel, logVersionExported, logVersionDashboardViewed,
  compareVersions, getVersionLineage,
} from '@/lib/document-version-control-service';
import type { VersionControlKpis, DocumentVersionRecord } from '@/lib/document-version-control-types';
import { REVISION_TYPES } from '@/lib/document-version-control-types';
import {
  getCurrentVersions, getVersionHistory, getPendingRevisions, getRecentMajorRevisions,
  getRecentMinorRevisions, getArchivedVersions, VERSION_KPI_FILTER_MAP,
} from '@/lib/document-version-control-records';
import { DMS_DEPARTMENTS, DOCUMENT_TYPES } from '@/lib/dms-types';
import { cn } from '@/lib/utils';

const KPI_ITEMS: { label: string; key: keyof VersionControlKpis; filterKey?: string; tone?: 'blue' | 'green' | 'amber' | 'red' }[] = [
  { label: 'Total Versions', key: 'totalVersions', tone: 'blue' },
  { label: 'Current Effective', key: 'currentEffective', filterKey: 'effective', tone: 'green' },
  { label: 'Draft Versions', key: 'draftVersions', filterKey: 'draft' },
  { label: 'Pending Review', key: 'pendingReview', filterKey: 'pending_review', tone: 'amber' },
  { label: 'Pending Approval', key: 'pendingApproval', filterKey: 'pending_approval', tone: 'amber' },
  { label: 'Superseded', key: 'supersededVersions', filterKey: 'superseded' },
  { label: 'Archived', key: 'archivedVersions', filterKey: 'archived' },
  { label: 'Major Revisions', key: 'majorRevisions', filterKey: 'major' },
  { label: 'Minor Revisions', key: 'minorRevisions', filterKey: 'minor' },
];

export function DocumentVersionControlPage() {
  return (<Suspense fallback={<LoadingSkeleton rows={8} />}><DocumentVersionControlContent /></Suspense>);
}

function DocumentVersionControlContent() {
  const searchParams = useSearchParams();
  const viewedLogged = useRef(false);
  const [activeKpi, setActiveKpi] = useState<string | null>(null);
  const [comparePair, setComparePair] = useState<{ a: DocumentVersionRecord; b: DocumentVersionRecord } | null>(null);
  const [lineage, setLineage] = useState<DocumentVersionRecord[]>([]);
  const {
    records, paginatedRecords, metrics, charts, filters, setFilters,
    loading, refreshing, error, refresh, actor, page, setPage, totalPages, pagination,
    selectedIds, toggleSelect, toggleSelectAll, canCreate, canExport, isReadOnly,
  } = useDocumentVersionControl();

  useEffect(() => {
    if (!viewedLogged.current && !loading && actor.id) {
      viewedLogged.current = true;
      void logVersionDashboardViewed(actor);
    }
  }, [loading, actor.id, actor]);

  useEffect(() => {
    const kpi = searchParams.get('kpi');
    if (kpi && VERSION_KPI_FILTER_MAP[kpi]) {
      setActiveKpi(kpi);
      setFilters((p) => ({ ...p, ...VERSION_KPI_FILTER_MAP[kpi] }));
    }
  }, [searchParams, setFilters]);

  const handleExport = useCallback((format: 'csv' | 'excel' | 'print') => {
    if (!records.length) { toast.error('No versions to export'); return; }
    if (format === 'csv') exportVersionsCsv(records);
    else if (format === 'excel') exportVersionsExcel(records);
    else window.print();
    void logVersionExported(actor, format, records.length);
    toast.success('Export complete');
  }, [records, actor]);

  const handleCompare = () => {
    if (selectedIds.length !== 2) { toast.error('Select exactly two versions to compare'); return; }
    const a = records.find((r) => r.id === selectedIds[0]);
    const b = records.find((r) => r.id === selectedIds[1]);
    if (!a || !b) return;
    setComparePair({ a, b });
  };

  const handleShowLineage = async () => {
    if (selectedIds.length !== 1) { toast.error('Select one version to view lineage'); return; }
    const r = records.find((x) => x.id === selectedIds[0]);
    if (!r) return;
    const lin = await getVersionLineage(r.document_number);
    setLineage(lin);
  };

  if (loading && !records.length) return <VcSkeleton rows={8} />;
  if (error) return <ErrorCard message={error} onRetry={() => refresh()} />;

  return (
    <div className="space-y-6 animate-in fade-in print:space-y-4">
      <DmsPageHeader
        title="Document Version Control"
        description="Manage document revisions, version history, and complete change traceability."
        trail={[{ label: 'Version Control' }]}
        actions={<>
          {canCreate && (
            <Button size="sm" asChild>
              <Link href="/qms/documents/version-control/create"><Plus className="h-4 w-4 mr-1" /> New Revision</Link>
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
          {selectedIds.length === 2 && (
            <Button variant="outline" size="sm" onClick={handleCompare}><GitCompare className="h-4 w-4 mr-1" /> Compare</Button>
          )}
          {selectedIds.length === 1 && (
            <Button variant="outline" size="sm" onClick={() => void handleShowLineage()}><RotateCcw className="h-4 w-4 mr-1" /> Lineage</Button>
          )}
        </>}
      />

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Input placeholder="Search versions..." value={filters.search || ''} onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1); }} className="max-w-xs" />
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.revision_type || ''} onChange={(e) => { setFilters({ ...filters, revision_type: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Revision Types</option>
              {REVISION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
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

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {KPI_ITEMS.map((item) => item.filterKey ? (
          <button key={item.key} type="button" onClick={() => {
            const active = activeKpi === item.filterKey;
            setActiveKpi(active ? null : item.filterKey!);
            setFilters(active ? {} : VERSION_KPI_FILTER_MAP[item.filterKey!] || {});
            setPage(1);
          }} className={cn('text-left', activeKpi === item.filterKey && 'ring-2 ring-blue-500 rounded-lg')}>
            <KpiCard label={item.label} value={metrics[item.key]} tone={item.tone} />
          </button>
        ) : (
          <KpiCard key={item.key} label={item.label} value={metrics[item.key]} tone={item.tone} />
        ))}
      </div>

      <VersionControlCharts charts={charts} />

      {comparePair && (
        <VersionComparison
          from={comparePair.a.version_number}
          to={comparePair.b.version_number}
          diff={compareVersions(comparePair.a, comparePair.b).diff}
        />
      )}

      {lineage.length > 0 && (
        <Card><CardContent className="pt-6"><h3 className="font-semibold mb-4">Version Lineage — {lineage[0]?.document_number}</h3><VersionTimeline versions={lineage} /></CardContent></Card>
      )}

      <Tabs defaultValue="current" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="current">Current Versions ({getCurrentVersions(records).length})</TabsTrigger>
          <TabsTrigger value="history">Version History ({records.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending Revisions ({getPendingRevisions(records).length})</TabsTrigger>
          <TabsTrigger value="major">Major Revisions ({getRecentMajorRevisions(records).length})</TabsTrigger>
          <TabsTrigger value="minor">Minor Revisions ({getRecentMinorRevisions(records).length})</TabsTrigger>
          <TabsTrigger value="archived">Archived ({getArchivedVersions(records).length})</TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          <Card>
            <CardContent className="p-0">
              <RevisionHistoryTable records={paginatedRecords} selectedIds={selectedIds} toggleSelect={toggleSelect} toggleSelectAll={toggleSelectAll} isReadOnly={isReadOnly} />
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
          { v: 'current', d: getCurrentVersions(records) },
          { v: 'pending', d: getPendingRevisions(records) },
          { v: 'major', d: getRecentMajorRevisions(records) },
          { v: 'minor', d: getRecentMinorRevisions(records) },
          { v: 'archived', d: getArchivedVersions(records) },
        ].map(({ v, d }) => (
          <TabsContent key={v} value={v}>
            <Card><CardContent className="p-0"><RevisionHistoryTable records={d.slice(0, 20)} isReadOnly={isReadOnly} compact /></CardContent></Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
