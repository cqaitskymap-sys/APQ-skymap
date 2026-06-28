'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, RefreshCw, Printer, Play, RotateCcw, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { DmsPageHeader } from '@/components/dms/dms-page-header';
import { useEffectiveDateManagement } from '@/hooks/use-effective-date-management';
import { EdmCharts } from '@/components/effective-date-management/edm-charts';
import {
  EffectiveDateTable, ActivationQueue, LoadingSkeleton as EdmSkeleton,
} from '@/components/effective-date-management/edm-ui';
import { RollbackDialog } from '@/components/effective-date-management/rollback-dialog';
import {
  exportEffectiveDatesCsv, exportEffectiveDatesExcel, logEffectiveDateExported,
  logEffectiveDateDashboardViewed, activateManually, rollbackActivation, bulkActivate,
} from '@/lib/effective-date-service';
import type { EffectiveDateKpis, EffectiveDateRecord } from '@/lib/effective-date-types';
import { ACTIVATION_STATUSES } from '@/lib/effective-date-types';
import {
  getUpcomingActivations, getTodaysActivations, getDelayedActivations,
  getRollbackHistory, getTrainingBlocked, getRecentlyActivated, EDM_KPI_FILTER_MAP,
} from '@/lib/effective-date-records';
import { DMS_DEPARTMENTS, DOCUMENT_TYPES } from '@/lib/dms-types';
import { cn } from '@/lib/utils';

const KPI_ITEMS: { label: string; key: keyof EffectiveDateKpis; filterKey?: string; tone?: 'blue' | 'green' | 'amber' | 'red' }[] = [
  { label: 'Pending Activations', key: 'pendingActivations', filterKey: 'pending', tone: 'amber' },
  { label: "Today's Activations", key: 'todaysActivations', filterKey: 'today', tone: 'green' },
  { label: 'Delayed Activations', key: 'delayedActivations', filterKey: 'delayed', tone: 'red' },
  { label: 'Cancelled Activations', key: 'cancelledActivations', tone: 'amber' },
  { label: 'Awaiting Training', key: 'awaitingTraining', filterKey: 'training', tone: 'amber' },
  { label: 'Active Effective Docs', key: 'activeEffectiveDocuments', filterKey: 'activated', tone: 'green' },
  { label: 'Rollback Events', key: 'rollbackEvents', filterKey: 'rollback', tone: 'red' },
  { label: 'Upcoming Effective Dates', key: 'upcomingEffectiveDates', filterKey: 'upcoming', tone: 'blue' },
];

export function EffectiveDateManagementPage() {
  return (<Suspense fallback={<LoadingSkeleton rows={8} />}><EffectiveDateManagementContent /></Suspense>);
}

function EffectiveDateManagementContent() {
  const searchParams = useSearchParams();
  const viewedLogged = useRef(false);
  const [activeKpi, setActiveKpi] = useState<string | null>(null);
  const [rollbackRecord, setRollbackRecord] = useState<EffectiveDateRecord | null>(null);

  const {
    records, paginatedRecords, metrics, charts, filters, setFilters,
    loading, refreshing, error, refresh, actor, page, setPage, totalPages, pagination,
    selectedIds, toggleSelect, toggleSelectAll, clearSelection,
    canExport, canManage, canBulk, canOverride, isReadOnly, canView,
  } = useEffectiveDateManagement();

  useEffect(() => {
    if (!viewedLogged.current && !loading && actor.id) {
      viewedLogged.current = true;
      void logEffectiveDateDashboardViewed(actor);
    }
  }, [loading, actor.id, actor]);

  useEffect(() => {
    const kpi = searchParams.get('kpi');
    if (kpi && EDM_KPI_FILTER_MAP[kpi]) {
      setActiveKpi(kpi);
      setFilters((p) => ({ ...p, ...EDM_KPI_FILTER_MAP[kpi] }));
    }
  }, [searchParams, setFilters]);

  const handleExport = useCallback((format: 'csv' | 'excel' | 'print') => {
    if (!records.length) { toast.error('No records to export'); return; }
    if (format === 'csv') exportEffectiveDatesCsv(records);
    else if (format === 'excel') exportEffectiveDatesExcel(records);
    else window.print();
    void logEffectiveDateExported(actor, format, records.length);
    toast.success('Export complete');
  }, [records, actor]);

  const handleActivate = async (id: string) => {
    try {
      await activateManually(id, actor, canOverride ? { reason: 'Manual activation from queue' } : undefined);
      toast.success('Document activated');
      refresh(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Activation failed'); }
  };

  const handleBulkActivate = async () => {
    if (!selectedIds.length) { toast.error('Select records first'); return; }
    const count = await bulkActivate(selectedIds, actor);
    toast.success(`${count} document(s) activated`);
    clearSelection();
    refresh(true);
  };

  const handleRollback = async (input: { reason: string }) => {
    if (!rollbackRecord) return;
    try {
      await rollbackActivation(rollbackRecord.id, input, actor);
      toast.success('Rollback completed');
      setRollbackRecord(null);
      refresh(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Rollback failed'); }
  };

  const queueRecords = getUpcomingActivations(records).filter((r) => ['Ready', 'Scheduled'].includes(r.activation_status));

  if (!canView) return <ErrorCard message="You do not have access to effective date management." />;
  if (loading && !records.length) return <EdmSkeleton rows={8} />;
  if (error) return <ErrorCard message={error} onRetry={() => refresh()} />;

  return (
    <div className="space-y-6 animate-in fade-in print:space-y-4">
      <DmsPageHeader
        title="Effective Date Management"
        description="Control document activation, superseding, and regulatory effective dates."
        trail={[{ label: 'Effective Date Management' }]}
        actions={<>
          <Button variant="outline" size="sm" onClick={() => refresh(true)} disabled={refreshing}>
            <RefreshCw className={cn('h-4 w-4 mr-1', refreshing && 'animate-spin')} /> Refresh
          </Button>
          {canBulk && selectedIds.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => void handleBulkActivate()}>
              <Play className="h-4 w-4 mr-1" /> Bulk Activate ({selectedIds.length})
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
              {ACTIVATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
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
            setFilters(active ? {} : EDM_KPI_FILTER_MAP[item.filterKey!] || {});
            setPage(1);
          }} className={cn('text-left', activeKpi === item.filterKey && 'ring-2 ring-emerald-500 rounded-lg')}>
            <KpiCard label={item.label} value={metrics[item.key]} tone={item.tone} />
          </button>
        ) : (
          <KpiCard key={item.key} label={item.label} value={metrics[item.key]} tone={item.tone} />
        ))}
      </div>

      <EdmCharts charts={charts} />

      {canManage && queueRecords.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Calendar className="h-5 w-5" /> Activation Queue</h2>
          <ActivationQueue records={queueRecords.slice(0, 6)} onActivate={(id) => void handleActivate(id)} />
        </div>
      )}

      <Tabs defaultValue="upcoming" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="upcoming">Upcoming ({getUpcomingActivations(records).length})</TabsTrigger>
          <TabsTrigger value="today">Today ({getTodaysActivations(records).length})</TabsTrigger>
          <TabsTrigger value="delayed">Delayed ({getDelayedActivations(records).length})</TabsTrigger>
          <TabsTrigger value="training">Training Blocked ({getTrainingBlocked(records).length})</TabsTrigger>
          <TabsTrigger value="activated">Recently Activated ({getRecentlyActivated(records).length})</TabsTrigger>
          <TabsTrigger value="rollback">Rollback ({getRollbackHistory(records).length})</TabsTrigger>
          <TabsTrigger value="all">All ({records.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card>
            <CardContent className="p-0">
              <EffectiveDateTable records={paginatedRecords} selectedIds={selectedIds} toggleSelect={toggleSelect} toggleSelectAll={toggleSelectAll} isReadOnly={isReadOnly} />
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
          { v: 'upcoming', d: getUpcomingActivations(records) },
          { v: 'today', d: getTodaysActivations(records) },
          { v: 'delayed', d: getDelayedActivations(records) },
          { v: 'training', d: getTrainingBlocked(records) },
          { v: 'activated', d: getRecentlyActivated(records) },
          { v: 'rollback', d: getRollbackHistory(records) },
        ].map(({ v, d }) => (
          <TabsContent key={v} value={v}>
            <Card>
              <CardContent className="p-0">
                <EffectiveDateTable records={d.slice(0, 20)} isReadOnly={isReadOnly} compact />
                {v === 'rollback' && canManage && d.length > 0 && (
                  <div className="p-3 border-t flex gap-2">
                    {d.slice(0, 3).map((r) => (
                      <Button key={r.id} variant="outline" size="sm" onClick={() => setRollbackRecord(r)}>
                        <RotateCcw className="h-3 w-3 mr-1" /> Rollback {r.document_number}
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <RollbackDialog
        open={Boolean(rollbackRecord)}
        onOpenChange={(o) => { if (!o) setRollbackRecord(null); }}
        documentNumber={rollbackRecord?.document_number}
        onRollback={(input) => void handleRollback(input)}
      />
    </div>
  );
}
