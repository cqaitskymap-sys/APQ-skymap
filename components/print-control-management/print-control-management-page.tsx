'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, RefreshCw, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { DmsPageHeader } from '@/components/dms/dms-page-header';
import { usePrintControlManagement } from '@/hooks/use-print-control-management';
import { PcmCharts } from '@/components/print-control-management/pcm-charts';
import {
  PrintRequestTable, CopyTrackingTable, ControlledCopyCard,
  BarcodeViewer, QRCodeViewer, LoadingSkeleton as PcmSkeleton,
} from '@/components/print-control-management/pcm-ui';
import { IssueReturnDialog } from '@/components/print-control-management/issue-return-dialog';
import {
  exportPrintControlCsv, exportPrintControlExcel, logPrintExported, logPrintDashboardViewed,
  approvePrintRequest, generatePrintCopies, issueCopy, returnCopy, reconcileCopy, destroyCopy,
} from '@/lib/print-control-service';
import type { PrintControlKpis, PrintRequestRecord, PrintCopyRecord } from '@/lib/print-control-types';
import { PRINT_STATUSES, PRINT_TYPES } from '@/lib/print-control-types';
import {
  PCM_KPI_FILTER_MAP, getRecentRequests, getPendingApprovals, getOutstandingCopies,
  getPendingReturns, getPendingReconciliation, getDestroyedCopies, getReplacementCopies,
} from '@/lib/print-control-records';
import { DMS_DEPARTMENTS } from '@/lib/dms-types';
import { cn } from '@/lib/utils';

const KPI_ITEMS: { label: string; key: keyof PrintControlKpis; filterKey?: string; tone?: 'blue' | 'green' | 'amber' | 'red' }[] = [
  { label: 'Print Requests', key: 'printRequests', filterKey: 'requests', tone: 'blue' },
  { label: 'Controlled Copies', key: 'controlledCopies', filterKey: 'controlled', tone: 'blue' },
  { label: 'Issued Copies', key: 'issuedCopies', tone: 'green' },
  { label: 'Returned Copies', key: 'returnedCopies', tone: 'green' },
  { label: 'Outstanding Copies', key: 'outstandingCopies', filterKey: 'outstanding', tone: 'amber' },
  { label: 'Destroyed Copies', key: 'destroyedCopies', filterKey: 'destroyed', tone: 'red' },
  { label: 'Pending Approvals', key: 'pendingApprovals', filterKey: 'approval', tone: 'amber' },
  { label: 'Reconciliation Pending', key: 'reconciliationPending', filterKey: 'reconciliation', tone: 'amber' },
];

export function PrintControlManagementPage() {
  return (<Suspense fallback={<LoadingSkeleton rows={8} />}><PrintControlContent /></Suspense>);
}

function PrintControlContent() {
  const searchParams = useSearchParams();
  const viewedLogged = useRef(false);
  const [activeKpi, setActiveKpi] = useState<string | null>(null);
  const [detailRequest, setDetailRequest] = useState<PrintRequestRecord | null>(null);
  const [dialogCopy, setDialogCopy] = useState<PrintCopyRecord | null>(null);
  const [dialogMode, setDialogMode] = useState<'issue' | 'return' | 'reconcile' | 'destroy'>('issue');

  const {
    requests, paginatedRequests, copies, metrics, charts, filters, setFilters,
    loading, refreshing, error, refresh, actor, page, setPage, totalPages, pagination,
    selectedIds, toggleSelect, toggleSelectAll,
    canExport, canManage, canApprove, isReadOnly, canView,
  } = usePrintControlManagement();

  useEffect(() => {
    if (!viewedLogged.current && !loading && actor.id) {
      viewedLogged.current = true;
      void logPrintDashboardViewed(actor);
    }
  }, [loading, actor.id, actor]);

  useEffect(() => {
    const kpi = searchParams.get('kpi');
    if (kpi && PCM_KPI_FILTER_MAP[kpi]) {
      setActiveKpi(kpi);
      setFilters((p) => ({ ...p, ...PCM_KPI_FILTER_MAP[kpi] }));
    }
  }, [searchParams, setFilters]);

  const handleExport = useCallback((format: 'csv' | 'excel' | 'print') => {
    if (!requests.length) { toast.error('No records to export'); return; }
    if (format === 'csv') exportPrintControlCsv(requests);
    else if (format === 'excel') exportPrintControlExcel(requests);
    else window.print();
    void logPrintExported(actor, format, requests.length);
    toast.success('Export complete');
  }, [requests, actor]);

  const handleApprove = async (id: string) => {
    try {
      await approvePrintRequest(id, { signature_meaning: 'I approve controlled printing', comments: '' }, actor);
      toast.success('Print request approved');
      refresh(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Approval failed'); }
  };

  const handleGenerate = async (id: string) => {
    try {
      const generated = await generatePrintCopies(id, actor);
      toast.success(`${generated.length} copies generated with barcodes`);
      refresh(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Generation failed'); }
  };

  const openDialog = (copy: PrintCopyRecord, mode: typeof dialogMode) => {
    setDialogCopy(copy);
    setDialogMode(mode);
  };

  const handleDialogSubmit = async (data: Record<string, string | undefined>) => {
    if (!dialogCopy) return;
    if (dialogMode === 'issue') {
      await issueCopy({ copy_id: dialogCopy.id, issued_to: data.issued_to || actor.id, issued_to_name: data.issued_to_name! }, actor);
      toast.success('Copy issued');
    } else if (dialogMode === 'return') {
      await returnCopy({ copy_id: dialogCopy.id, return_notes: data.return_notes || '' }, actor);
      toast.success('Copy returned');
    } else if (dialogMode === 'reconcile') {
      await reconcileCopy({ copy_id: dialogCopy.id, notes: data.notes || '' }, actor);
      toast.success('Copy reconciled');
    } else {
      await destroyCopy({ copy_id: dialogCopy.id, reason: data.reason! }, actor);
      toast.success('Copy destroyed');
    }
    setDialogCopy(null);
    refresh(true);
  };

  if (!canView) return <ErrorCard message="You do not have access to print control management." />;
  if (loading && !requests.length) return <PcmSkeleton rows={8} />;
  if (error) return <ErrorCard message={error} onRetry={() => refresh()} />;

  const requestCopies = detailRequest ? copies.filter((c) => c.print_request_id === detailRequest.id) : [];

  return (
    <div className="space-y-6 animate-in fade-in print:space-y-4">
      <DmsPageHeader
        title="Print Control Management"
        description="Manage controlled printing, issuance, reconciliation, and destruction of GMP documents."
        trail={[{ label: 'Print Control Management' }]}
        actions={<>
          <Button variant="outline" size="sm" onClick={() => refresh(true)} disabled={refreshing}>
            <RefreshCw className={cn('h-4 w-4 mr-1', refreshing && 'animate-spin')} /> Refresh
          </Button>
          {canExport && (<>
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')}><Download className="h-4 w-4 mr-1" /> CSV</Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('excel')}><Download className="h-4 w-4 mr-1" /> Excel</Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('print')}><Printer className="h-4 w-4 mr-1" /> Print Report</Button>
          </>)}
        </>}
      />

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Input placeholder="Search print requests..." value={filters.search || ''}
              onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1); }} className="max-w-xs" />
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.status || ''}
              onChange={(e) => { setFilters({ ...filters, status: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Statuses</option>
              {PRINT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.print_type || ''}
              onChange={(e) => { setFilters({ ...filters, print_type: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Print Types</option>
              {PRINT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
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
            setFilters(active ? {} : PCM_KPI_FILTER_MAP[item.filterKey!] || {});
            setPage(1);
          }} className={cn('text-left', activeKpi === item.filterKey && 'ring-2 ring-indigo-500 rounded-lg')}>
            <KpiCard label={item.label} value={metrics[item.key]} tone={item.tone} />
          </button>
        ) : (
          <KpiCard key={item.key} label={item.label} value={metrics[item.key]} tone={item.tone} />
        ))}
      </div>

      <PcmCharts charts={charts} />

      {detailRequest && (
        <Card>
          <CardContent className="pt-4 space-y-4">
            <div className="flex justify-between items-start">
              <h3 className="font-semibold">Print Request — {detailRequest.print_number}</h3>
              <Button variant="ghost" size="sm" onClick={() => setDetailRequest(null)}>Close</Button>
            </div>
            <p className="text-sm">{detailRequest.document_title} · {detailRequest.document_number} v{detailRequest.version}</p>
            <p className="text-xs text-muted-foreground">Watermark: {detailRequest.print_watermark}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {detailRequest.barcode && <BarcodeViewer barcode={detailRequest.barcode} />}
              {detailRequest.qr_code && <QRCodeViewer qrCode={detailRequest.qr_code} />}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {requestCopies.map((c) => <ControlledCopyCard key={c.id} copy={c} />)}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="requests" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="requests">Recent Requests ({getRecentRequests(requests).length})</TabsTrigger>
          <TabsTrigger value="outstanding">Outstanding ({getOutstandingCopies(copies).length})</TabsTrigger>
          <TabsTrigger value="returns">Pending Returns ({getPendingReturns(copies).length})</TabsTrigger>
          <TabsTrigger value="reconciliation">Reconciliation ({getPendingReconciliation(copies).length})</TabsTrigger>
          <TabsTrigger value="destroyed">Destroyed ({getDestroyedCopies(copies).length})</TabsTrigger>
          <TabsTrigger value="replacement">Replacements ({getReplacementCopies(copies).length})</TabsTrigger>
          <TabsTrigger value="copies">All Copies ({copies.length})</TabsTrigger>
          <TabsTrigger value="all">All Requests ({requests.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          <Card><CardContent className="p-0">
            <PrintRequestTable requests={getRecentRequests(requests).slice(0, 20)} selectedIds={[]} toggleSelect={() => {}} toggleSelectAll={() => {}} isReadOnly
              onDetail={setDetailRequest} onApprove={canApprove ? handleApprove : undefined} onGenerate={canManage ? handleGenerate : undefined} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="outstanding">
          <Card><CardContent className="p-0">
            <CopyTrackingTable copies={getOutstandingCopies(copies)} isReadOnly={isReadOnly}
              onReturn={canManage ? (c) => openDialog(c, 'return') : undefined} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="returns">
          <Card><CardContent className="p-0">
            <CopyTrackingTable copies={getPendingReturns(copies)} isReadOnly={isReadOnly}
              onReturn={canManage ? (c) => openDialog(c, 'return') : undefined} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="reconciliation">
          <Card><CardContent className="p-0">
            <CopyTrackingTable copies={getPendingReconciliation(copies)} isReadOnly={isReadOnly}
              onReconcile={canManage ? (c) => openDialog(c, 'reconcile') : undefined} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="destroyed">
          <Card><CardContent className="p-0">
            <CopyTrackingTable copies={getDestroyedCopies(copies)} isReadOnly />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="replacement">
          <Card><CardContent className="pt-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {getReplacementCopies(copies).map((c) => <ControlledCopyCard key={c.id} copy={c} />)}
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="copies">
          <Card><CardContent className="p-0">
            <CopyTrackingTable copies={copies} isReadOnly={isReadOnly}
              onIssue={canManage ? (c) => openDialog(c, 'issue') : undefined}
              onReturn={canManage ? (c) => openDialog(c, 'return') : undefined}
              onReconcile={canManage ? (c) => openDialog(c, 'reconcile') : undefined}
              onDestroy={canManage ? (c) => openDialog(c, 'destroy') : undefined} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="all">
          <Card><CardContent className="p-0">
            <PrintRequestTable requests={paginatedRequests} selectedIds={selectedIds} toggleSelect={toggleSelect} toggleSelectAll={toggleSelectAll} isReadOnly={isReadOnly}
              onDetail={setDetailRequest} onApprove={canApprove ? handleApprove : undefined} onGenerate={canManage ? handleGenerate : undefined} />
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

      <IssueReturnDialog
        copy={dialogCopy}
        open={!!dialogCopy}
        onOpenChange={(o) => !o && setDialogCopy(null)}
        mode={dialogMode}
        onSubmit={handleDialogSubmit}
      />
    </div>
  );
}
