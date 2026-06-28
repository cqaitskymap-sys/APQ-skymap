'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, RefreshCw, Printer, Archive, Eye, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { DmsPageHeader } from '@/components/dms/dms-page-header';
import { useArchiveManagement } from '@/hooks/use-archive-management';
import { AmCharts } from '@/components/archive-management/am-charts';
import {
  ArchiveTable, ArchiveCard, ChecksumCard, RetentionPolicyViewer,
  LegalHoldPanel, StorageViewer, LoadingSkeleton as AmSkeleton,
} from '@/components/archive-management/am-ui';
import { RestoreDialog } from '@/components/archive-management/restore-dialog';
import {
  exportArchiveCsv, exportArchiveExcel, logArchiveExported, logArchiveDashboardViewed,
  approveArchiveRequest, completeArchive, requestRestoration, approveRestoration,
  verifyChecksum, applyHold, toggleInspectionMode,
} from '@/lib/archive-management-service';
import type { ArchiveKpis, ArchiveRecord } from '@/lib/archive-management-types';
import { ARCHIVE_STATUSES, ARCHIVE_CATEGORIES, DEFAULT_ARCHIVE_LOCATIONS } from '@/lib/archive-management-types';
import { AM_KPI_FILTER_MAP, formatStorageBytes, getRecentlyArchived, getPendingArchive, getRestorationRequests, getRetentionExpiring, getDestroyedRecords, getLegalHoldRecords } from '@/lib/archive-management-records';
import { DMS_DEPARTMENTS } from '@/lib/dms-types';
import { cn } from '@/lib/utils';

const KPI_ITEMS: { label: string; key: keyof ArchiveKpis; filterKey?: string; tone?: 'blue' | 'green' | 'amber' | 'red' }[] = [
  { label: 'Archived Documents', key: 'archivedDocuments', filterKey: 'archived', tone: 'blue' },
  { label: 'Pending Archive', key: 'pendingArchive', filterKey: 'pending', tone: 'amber' },
  { label: 'Restoration Requests', key: 'restorationRequests', filterKey: 'restoration', tone: 'orange' as 'amber' },
  { label: 'Retention Expiring', key: 'retentionExpiring', filterKey: 'retention', tone: 'amber' },
  { label: 'Destroyed Records', key: 'destroyedRecords', filterKey: 'destroyed', tone: 'red' },
  { label: 'Legal Holds', key: 'legalHolds', filterKey: 'legal', tone: 'red' },
  { label: 'Regulatory Holds', key: 'regulatoryHolds', filterKey: 'regulatory', tone: 'amber' },
  { label: 'Storage Usage', key: 'archiveStorageUsage', tone: 'blue' },
];

export function ArchiveManagementPage() {
  return (<Suspense fallback={<LoadingSkeleton rows={8} />}><ArchiveManagementContent /></Suspense>);
}

function ArchiveManagementContent() {
  const searchParams = useSearchParams();
  const viewedLogged = useRef(false);
  const [activeKpi, setActiveKpi] = useState<string | null>(null);
  const [detailRecord, setDetailRecord] = useState<ArchiveRecord | null>(null);
  const [restoreRecord, setRestoreRecord] = useState<ArchiveRecord | null>(null);
  const [restoreMode, setRestoreMode] = useState<'request' | 'approve'>('request');
  const [inspectionMode, setInspectionMode] = useState(false);

  const {
    records, paginatedRecords, metrics, charts, filters, setFilters,
    loading, refreshing, error, refresh, actor, page, setPage, totalPages, pagination,
    selectedIds, toggleSelect, toggleSelectAll,
    canExport, canManage, canApprove, canRestore, isReadOnly, canView,
  } = useArchiveManagement();

  useEffect(() => {
    if (!viewedLogged.current && !loading && actor.id) {
      viewedLogged.current = true;
      void logArchiveDashboardViewed(actor);
    }
  }, [loading, actor.id, actor]);

  useEffect(() => {
    const kpi = searchParams.get('kpi');
    if (kpi && AM_KPI_FILTER_MAP[kpi]) {
      setActiveKpi(kpi);
      setFilters((p) => ({ ...p, ...AM_KPI_FILTER_MAP[kpi] }));
    }
  }, [searchParams, setFilters]);

  const handleExport = useCallback((format: 'csv' | 'excel' | 'print') => {
    if (!records.length) { toast.error('No records to export'); return; }
    if (format === 'csv') exportArchiveCsv(records);
    else if (format === 'excel') exportArchiveExcel(records);
    else window.print();
    void logArchiveExported(actor, format, records.length);
    toast.success('Export complete');
  }, [records, actor]);

  const handleApprove = async (id: string) => {
    try {
      await approveArchiveRequest(id, { comments: 'Approved via dashboard' }, actor);
      toast.success('Archive approved');
      refresh(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Approval failed'); }
  };

  const handleComplete = async (id: string) => {
    try {
      await completeArchive(id, actor);
      toast.success('Archive completed');
      refresh(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Completion failed'); }
  };

  const handleVerify = async (id: string) => {
    try {
      const ok = await verifyChecksum(id, actor);
      toast.success(ok ? 'Checksum verified' : 'Checksum mismatch detected');
      refresh(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Verification failed'); }
  };

  const handleRestoreSubmit = async (input: { restoration_reason?: string; signature_meaning?: string; comments?: string }) => {
    if (!restoreRecord) return;
    if (restoreMode === 'request') {
      await requestRestoration(restoreRecord.id, { restoration_reason: input.restoration_reason! }, actor);
      toast.success('Restoration requested');
    } else {
      await approveRestoration(restoreRecord.id, { signature_meaning: input.signature_meaning || '', comments: input.comments || '' }, actor);
      toast.success('Restoration approved');
    }
    setRestoreRecord(null);
    refresh(true);
  };

  const handleApplyHold = async (id: string, type: 'legal' | 'regulatory') => {
    try {
      await applyHold(id, { hold_type: type, reason: `${type} hold applied from dashboard` }, actor);
      toast.success(`${type === 'legal' ? 'Legal' : 'Regulatory'} hold applied`);
      refresh(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hold failed'); }
  };

  if (!canView) return <ErrorCard message="You do not have access to archive management." />;
  if (loading && !records.length) return <AmSkeleton rows={8} />;
  if (error) return <ErrorCard message={error} onRetry={() => refresh()} />;

  const pendingRecords = getPendingArchive(records).slice(0, 4);
  const storageDisplay = formatStorageBytes(metrics.archiveStorageUsage);

  return (
    <div className="space-y-6 animate-in fade-in print:space-y-4">
      <DmsPageHeader
        title="Archive Management"
        description="Securely preserve controlled GMP documents while maintaining complete regulatory traceability."
        trail={[{ label: 'Archive Management' }]}
        actions={<>
          <Button variant="outline" size="sm" onClick={() => refresh(true)} disabled={refreshing}>
            <RefreshCw className={cn('h-4 w-4 mr-1', refreshing && 'animate-spin')} /> Refresh
          </Button>
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => {
              setInspectionMode(!inspectionMode);
              toast.info(inspectionMode ? 'Inspection mode disabled' : 'Inspection mode enabled — read-only audit view');
            }}>
              <Eye className="h-4 w-4 mr-1" /> {inspectionMode ? 'Exit Inspection' : 'Inspection Mode'}
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
            <Input placeholder="Search archives..." value={filters.search || ''}
              onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1); }} className="max-w-xs" />
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.status || ''}
              onChange={(e) => { setFilters({ ...filters, status: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Statuses</option>
              {ARCHIVE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.department || ''}
              onChange={(e) => { setFilters({ ...filters, department: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Departments</option>
              {DMS_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.archive_category || ''}
              onChange={(e) => { setFilters({ ...filters, archive_category: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Categories</option>
              {ARCHIVE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {KPI_ITEMS.map((item) => item.filterKey ? (
          <button key={item.key} type="button" onClick={() => {
            const active = activeKpi === item.filterKey;
            setActiveKpi(active ? null : item.filterKey!);
            setFilters(active ? {} : AM_KPI_FILTER_MAP[item.filterKey!] || {});
            setPage(1);
          }} className={cn('text-left', activeKpi === item.filterKey && 'ring-2 ring-purple-500 rounded-lg')}>
            <KpiCard label={item.label}
              value={item.key === 'archiveStorageUsage' ? storageDisplay : metrics[item.key]} tone={item.tone} />
          </button>
        ) : (
          <KpiCard key={item.key} label={item.label}
            value={item.key === 'archiveStorageUsage' ? storageDisplay : metrics[item.key]} tone={item.tone} />
        ))}
      </div>

      <AmCharts charts={charts} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {canManage && pendingRecords.length > 0 && !inspectionMode && (
            <div className="space-y-3 mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Archive className="h-5 w-5" /> Pending Archive</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {pendingRecords.map((r) => (
                  <div key={r.id}>
                    <ArchiveCard record={r} />
                    {canApprove && r.archive_status === 'Pending' && (
                      <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => void handleApprove(r.id)}>
                        Approve Archive
                      </Button>
                    )}
                    {canManage && r.archive_status === 'Approved' && (
                      <Button size="sm" className="mt-2 w-full" onClick={() => void handleComplete(r.id)}>
                        Complete Archive
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <StorageViewer records={records} />
      </div>

      {detailRecord && (
        <Card>
          <CardContent className="pt-4 space-y-4">
            <div className="flex justify-between items-start">
              <h3 className="font-semibold">Archive Detail — {detailRecord.document_number}</h3>
              <Button variant="ghost" size="sm" onClick={() => setDetailRecord(null)}>Close</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <RetentionPolicyViewer record={detailRecord} />
              <ChecksumCard record={detailRecord} onVerify={!isReadOnly ? () => void handleVerify(detailRecord.id) : undefined} />
              <LegalHoldPanel record={detailRecord} />
            </div>
            <p className="text-sm text-muted-foreground">{detailRecord.archive_reason}</p>
            <p className="text-xs">Location: {detailRecord.archive_location || DEFAULT_ARCHIVE_LOCATIONS[0]}</p>
            {canManage && !inspectionMode && detailRecord.archive_status === 'Archived' && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => void handleApplyHold(detailRecord.id, 'legal')}>
                  <Shield className="h-3 w-3 mr-1" /> Legal Hold
                </Button>
                <Button size="sm" variant="outline" onClick={() => void handleApplyHold(detailRecord.id, 'regulatory')}>
                  <Shield className="h-3 w-3 mr-1" /> Regulatory Hold
                </Button>
                <Button size="sm" variant="outline" onClick={() => void toggleInspectionMode(detailRecord.id, true, actor).then(() => refresh(true))}>
                  Enable Record Inspection
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="recent" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="recent">Recently Archived ({getRecentlyArchived(records).length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({getPendingArchive(records).length})</TabsTrigger>
          <TabsTrigger value="restoration">Restoration ({getRestorationRequests(records).length})</TabsTrigger>
          <TabsTrigger value="retention">Retention Expiring ({getRetentionExpiring(records).length})</TabsTrigger>
          <TabsTrigger value="destroyed">Destroyed ({getDestroyedRecords(records).length})</TabsTrigger>
          <TabsTrigger value="holds">Legal Holds ({getLegalHoldRecords(records).length})</TabsTrigger>
          <TabsTrigger value="all">All ({records.length})</TabsTrigger>
        </TabsList>

        {[
          { v: 'recent', d: getRecentlyArchived(records) },
          { v: 'pending', d: getPendingArchive(records) },
          { v: 'restoration', d: getRestorationRequests(records) },
          { v: 'retention', d: getRetentionExpiring(records) },
          { v: 'destroyed', d: getDestroyedRecords(records) },
          { v: 'holds', d: getLegalHoldRecords(records) },
          { v: 'all', d: paginatedRecords },
        ].map(({ v, d }) => (
          <TabsContent key={v} value={v}>
            <Card>
              <CardContent className="p-0">
                <ArchiveTable
                  records={d}
                  selectedIds={selectedIds}
                  toggleSelect={toggleSelect}
                  toggleSelectAll={toggleSelectAll}
                  isReadOnly={isReadOnly || inspectionMode}
                  onDetail={setDetailRecord}
                  onApprove={canApprove && !inspectionMode ? handleApprove : undefined}
                  onComplete={canManage && !inspectionMode ? handleComplete : undefined}
                  onRestore={canRestore && !inspectionMode ? (r) => {
                    if (r.archive_status === 'Restoration Requested' && canApprove) {
                      setRestoreMode('approve'); setRestoreRecord(r);
                    } else {
                      setRestoreMode('request'); setRestoreRecord(r);
                    }
                  } : undefined}
                  onVerify={!isReadOnly ? handleVerify : undefined}
                />
                {v === 'all' && totalPages > 1 && (
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
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <RestoreDialog
        record={restoreRecord}
        open={!!restoreRecord}
        onOpenChange={(o) => !o && setRestoreRecord(null)}
        mode={restoreMode}
        onSubmit={handleRestoreSubmit}
      />
    </div>
  );
}
