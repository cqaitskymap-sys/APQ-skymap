'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Download, RefreshCw, Printer, Settings, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { EsignPageHeader } from '@/components/electronic-signatures/esign-page-header';
import { EsignCharts } from '@/components/electronic-signatures/esign-charts';
import {
  SignatureTable, DualSignaturePanel, LoadingSkeleton as EsignSkeleton,
} from '@/components/electronic-signatures/esign-ui';
import { useElectronicSignatures } from '@/hooks/use-electronic-signatures';
import {
  exportSignaturesCsv, exportSignaturesExcel, logSignatureExported,
  logSignatureDashboardViewed, verifySignature,
} from '@/lib/electronic-signatures-service';
import type { SignatureKpis } from '@/lib/electronic-signatures-types';
import { SUPPORTED_ESIG_MODULES } from '@/lib/electronic-signatures-types';
import {
  getPendingSignatures, getFailedSignatures, getDualPendingSignatures,
  getRecentSignatures, SIGNATURE_KPI_FILTER_MAP,
} from '@/lib/electronic-signatures-records';
import { cn } from '@/lib/utils';

const KPI_ITEMS: { label: string; key: keyof SignatureKpis; filterKey?: string; tone?: 'blue' | 'green' | 'amber' | 'red' }[] = [
  { label: 'Total Signatures', key: 'totalSignatures' },
  { label: "Today's Signatures", key: 'todaysSignatures', filterKey: 'today', tone: 'green' },
  { label: 'Pending Signatures', key: 'pendingSignatures', filterKey: 'pending', tone: 'amber' },
  { label: 'Failed Attempts', key: 'failedAttempts', filterKey: 'failed', tone: 'red' },
  { label: 'Document Signatures', key: 'documentSignatures', filterKey: 'document', tone: 'blue' },
  { label: 'Training Signatures', key: 'trainingSignatures', filterKey: 'training', tone: 'blue' },
  { label: 'Approval Signatures', key: 'approvalSignatures', filterKey: 'approval', tone: 'indigo' as 'blue' },
  { label: 'Dual Signatures', key: 'dualSignatures', filterKey: 'dual', tone: 'amber' },
];

export function ElectronicSignaturesPage() {
  return (<Suspense fallback={<LoadingSkeleton rows={8} />}><ElectronicSignaturesContent /></Suspense>);
}

function ElectronicSignaturesContent() {
  const searchParams = useSearchParams();
  const viewedLogged = useRef(false);
  const [activeKpi, setActiveKpi] = useState<string | null>(null);
  const {
    records, paginatedRecords, metrics, charts, filters, setFilters,
    loading, refreshing, error, refresh, actor, page, setPage, totalPages, pagination,
    selectedIds, toggleSelect, toggleSelectAll, canExport, canVerify, isReadOnly, canView,
  } = useElectronicSignatures();

  useEffect(() => {
    if (!viewedLogged.current && !loading && actor.id) {
      viewedLogged.current = true;
      void logSignatureDashboardViewed(actor);
    }
  }, [loading, actor.id, actor]);

  useEffect(() => {
    const kpi = searchParams.get('kpi');
    if (kpi && SIGNATURE_KPI_FILTER_MAP[kpi]) {
      setActiveKpi(kpi);
      setFilters((p) => ({ ...p, ...SIGNATURE_KPI_FILTER_MAP[kpi] }));
    }
  }, [searchParams, setFilters]);

  const handleExport = useCallback((format: 'csv' | 'excel' | 'print') => {
    if (!records.length) { toast.error('No signatures to export'); return; }
    if (format === 'csv') exportSignaturesCsv(records);
    else if (format === 'excel') exportSignaturesExcel(records);
    else window.print();
    void logSignatureExported(actor, format, records.length);
    toast.success('Export complete');
  }, [records, actor]);

  const handleVerify = async (id: string) => {
    try {
      const result = await verifySignature(id, actor);
      toast[result.valid ? 'success' : 'error'](result.message);
      refresh(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Verification failed'); }
  };

  if (!canView) return <ErrorCard message="You do not have access to electronic signatures." />;
  if (loading && !records.length) return <EsignSkeleton rows={8} />;
  if (error) return <ErrorCard message={error} onRetry={() => refresh()} />;

  return (
    <div className="space-y-6 animate-in fade-in print:space-y-4">
      <EsignPageHeader
        title="Electronic Signatures"
        description="FDA 21 CFR Part 11 compliant electronic signature management."
        trail={[{ label: 'Electronic Signatures' }]}
        actions={<>
          <Button size="sm" variant="outline" asChild>
            <Link href="/admin/esign-settings"><Settings className="h-4 w-4 mr-1" /> Signature Settings</Link>
          </Button>
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

      <Card className="border-indigo-100 bg-indigo-50/30 dark:bg-indigo-950/20">
        <CardContent className="pt-4 text-sm text-indigo-900 dark:text-indigo-200">
          Compliant with FDA 21 CFR Part 11, EU GMP Annex 11, PIC/S, WHO GMP, ALCOA+, and GAMP 5.
          All signatures require re-authentication, capture meaning, reason, UTC timestamp, device metadata, and tamper-evident SHA-256 hash.
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Input placeholder="Search signatures..." value={filters.search || ''} onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1); }} className="max-w-xs" />
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.status || ''} onChange={(e) => { setFilters({ ...filters, status: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Statuses</option>
              {['Signed', 'Verified', 'Failed', 'Pending', 'Dual Pending', 'Test'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.module || ''} onChange={(e) => { setFilters({ ...filters, module: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Modules</option>
              {SUPPORTED_ESIG_MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {KPI_ITEMS.map((item) => item.filterKey ? (
          <button key={item.key} type="button" onClick={() => {
            const active = activeKpi === item.filterKey;
            setActiveKpi(active ? null : item.filterKey!);
            setFilters(active ? {} : SIGNATURE_KPI_FILTER_MAP[item.filterKey!] || {});
            setPage(1);
          }} className={cn('text-left', activeKpi === item.filterKey && 'ring-2 ring-indigo-500 rounded-lg')}>
            <KpiCard label={item.label} value={metrics[item.key]} tone={item.tone} />
          </button>
        ) : (
          <KpiCard key={item.key} label={item.label} value={metrics[item.key]} tone={item.tone} />
        ))}
      </div>

      <EsignCharts charts={charts} />

      {getDualPendingSignatures(records).length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Dual Signatures Pending</h2>
          <DualSignaturePanel records={getDualPendingSignatures(records).slice(0, 6)} />
        </div>
      )}

      <Tabs defaultValue="recent" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="recent">Recent ({getRecentSignatures(records).length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({getPendingSignatures(records).length})</TabsTrigger>
          <TabsTrigger value="failed">Failed ({getFailedSignatures(records).length})</TabsTrigger>
          <TabsTrigger value="all">All Signatures ({records.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card>
            <CardContent className="p-0">
              <SignatureTable
                records={paginatedRecords}
                selectedIds={selectedIds}
                toggleSelect={toggleSelect}
                toggleSelectAll={toggleSelectAll}
                isReadOnly={isReadOnly}
                onVerify={canVerify ? handleVerify : undefined}
              />
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
          { v: 'recent', d: getRecentSignatures(records) },
          { v: 'pending', d: getPendingSignatures(records) },
          { v: 'failed', d: getFailedSignatures(records) },
        ].map(({ v, d }) => (
          <TabsContent key={v} value={v}>
            <Card>
              <CardContent className="p-0">
                <SignatureTable records={d.slice(0, 20)} isReadOnly={isReadOnly} compact onVerify={canVerify ? handleVerify : undefined} />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
