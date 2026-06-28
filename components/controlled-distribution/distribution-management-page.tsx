'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Download, RefreshCw, Printer, Plus, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { DmsPageHeader } from '@/components/dms/dms-page-header';
import { useControlledDistribution } from '@/hooks/use-controlled-distribution';
import { DistributionCharts } from '@/components/controlled-distribution/distribution-charts';
import { DistributionTable, LoadingSkeleton as DistSkeleton } from '@/components/controlled-distribution/distribution-ui';
import {
  exportDistributionCsv, exportDistributionExcel, logDistributionExported, withdrawDistribution,
} from '@/lib/controlled-distribution-service';
import type { DistributionKpis } from '@/lib/controlled-distribution-types';
import { DISTRIBUTION_TYPES } from '@/lib/controlled-distribution-types';
import {
  getPendingAcknowledgements, getUpcomingExpiry,
  getTrainingPending, getDistributionHistory, getRecentlyWithdrawn, DISTRIBUTION_KPI_FILTER_MAP,
} from '@/lib/controlled-distribution-records';
import { DMS_DEPARTMENTS, DOCUMENT_TYPES } from '@/lib/dms-types';
import { cn } from '@/lib/utils';

const KPI_ITEMS: { label: string; key: keyof DistributionKpis; filterKey?: string; tone?: 'blue' | 'green' | 'amber' | 'red' }[] = [
  { label: 'Total Distributions', key: 'totalDistributions', tone: 'blue' },
  { label: 'Active Distributions', key: 'activeDistributions', filterKey: 'active', tone: 'green' },
  { label: 'Pending Acknowledgements', key: 'pendingAcknowledgements', filterKey: 'pending_ack', tone: 'amber' },
  { label: 'Completed', key: 'completed', filterKey: 'completed', tone: 'green' },
  { label: 'Expired', key: 'expired', filterKey: 'expired' },
  { label: 'Cancelled', key: 'cancelled', filterKey: 'cancelled', tone: 'red' },
  { label: 'Training Pending', key: 'trainingPending', filterKey: 'training_pending', tone: 'amber' },
  { label: 'Read Confirmations Pending', key: 'readConfirmationsPending' },
];

export function ControlledDistributionPage() {
  return (<Suspense fallback={<LoadingSkeleton rows={8} />}><ControlledDistributionContent /></Suspense>);
}

function ControlledDistributionContent() {
  const searchParams = useSearchParams();
  const viewedLogged = useRef(false);
  const [activeKpi, setActiveKpi] = useState<string | null>(null);
  const {
    records, paginatedRecords, metrics, charts, filters, setFilters,
    loading, refreshing, error, refresh, actor, page, setPage, totalPages, pagination,
    selectedIds, toggleSelect, toggleSelectAll, clearSelection, logViewed,
    canCreate, canExport, isReadOnly,
  } = useControlledDistribution();

  useEffect(() => {
    if (!viewedLogged.current && !loading && actor.id) {
      viewedLogged.current = true;
      void logViewed();
    }
  }, [loading, actor.id, logViewed]);

  useEffect(() => {
    const kpi = searchParams.get('kpi');
    if (kpi && DISTRIBUTION_KPI_FILTER_MAP[kpi]) {
      setActiveKpi(kpi);
      setFilters((p) => ({ ...p, ...DISTRIBUTION_KPI_FILTER_MAP[kpi] }));
    }
  }, [searchParams, setFilters]);

  const handleExport = useCallback((format: 'csv' | 'excel' | 'print') => {
    if (!records.length) { toast.error('No distributions to export'); return; }
    if (format === 'csv') exportDistributionCsv(records);
    else if (format === 'excel') exportDistributionExcel(records);
    else window.print();
    void logDistributionExported(actor, format, records.length);
    toast.success('Export complete');
  }, [records, actor]);

  const handleWithdraw = async () => {
    if (selectedIds.length !== 1) { toast.error('Select exactly one distribution to withdraw'); return; }
    const reason = window.prompt('Withdrawal reason:');
    if (!reason) return;
    try {
      await withdrawDistribution(selectedIds[0], reason, actor);
      toast.success('Distribution withdrawn');
      clearSelection();
      refresh(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Withdrawal failed'); }
  };

  if (loading && !records.length) return <DistSkeleton rows={8} />;
  if (error) return <ErrorCard message={error} onRetry={() => refresh()} />;

  return (
    <div className="space-y-6 animate-in fade-in print:space-y-4">
      <DmsPageHeader
        title="Controlled Document Distribution"
        description="Distribute approved GMP documents to authorized users while maintaining version control and compliance."
        trail={[{ label: 'Controlled Document Distribution' }]}
        actions={<>
          {canCreate && (
            <Button size="sm" asChild>
              <Link href="/qms/documents/distribution/create"><Plus className="h-4 w-4 mr-1" /> New Distribution</Link>
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
          {canCreate && selectedIds.length === 1 && (
            <Button variant="outline" size="sm" onClick={() => void handleWithdraw()}><Send className="h-4 w-4 mr-1" /> Withdraw</Button>
          )}
        </>}
      />

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Input placeholder="Search distributions..." value={filters.search || ''} onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1); }} className="max-w-xs" />
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.distribution_type || ''} onChange={(e) => { setFilters({ ...filters, distribution_type: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Types</option>
              {DISTRIBUTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
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
            setFilters(active ? {} : DISTRIBUTION_KPI_FILTER_MAP[item.filterKey!] || {});
            setPage(1);
          }} className={cn('text-left', activeKpi === item.filterKey && 'ring-2 ring-blue-500 rounded-lg')}>
            <KpiCard label={item.label} value={metrics[item.key]} tone={item.tone} />
          </button>
        ) : (
          <KpiCard key={item.key} label={item.label} value={metrics[item.key]} tone={item.tone} />
        ))}
      </div>

      <DistributionCharts charts={charts} />

      <Tabs defaultValue="recent" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="recent">Recent ({records.length})</TabsTrigger>
          <TabsTrigger value="ack">Pending Acknowledgements ({getPendingAcknowledgements(records).length})</TabsTrigger>
          <TabsTrigger value="expiry">Upcoming Expiry ({getUpcomingExpiry(records).length})</TabsTrigger>
          <TabsTrigger value="training">Training Pending ({getTrainingPending(records).length})</TabsTrigger>
          <TabsTrigger value="history">Distribution History ({getDistributionHistory(records).length})</TabsTrigger>
          <TabsTrigger value="withdrawn">Recently Withdrawn ({getRecentlyWithdrawn(records).length})</TabsTrigger>
        </TabsList>

        <TabsContent value="recent">
          <Card>
            <CardContent className="p-0">
              <DistributionTable records={paginatedRecords} selectedIds={selectedIds} toggleSelect={toggleSelect} toggleSelectAll={toggleSelectAll} isReadOnly={isReadOnly} />
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
          { v: 'ack', d: getPendingAcknowledgements(records) },
          { v: 'expiry', d: getUpcomingExpiry(records) },
          { v: 'training', d: getTrainingPending(records) },
          { v: 'history', d: getDistributionHistory(records) },
          { v: 'withdrawn', d: getRecentlyWithdrawn(records) },
        ].map(({ v, d }) => (
          <TabsContent key={v} value={v}>
            <Card><CardContent className="p-0"><DistributionTable records={d.slice(0, 20)} isReadOnly={isReadOnly} compact /></CardContent></Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
