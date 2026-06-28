'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, RefreshCw, Printer, Bell, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { DmsPageHeader } from '@/components/dms/dms-page-header';
import { useDocumentAcknowledgement } from '@/hooks/use-document-acknowledgement';
import { AcknowledgementCharts } from '@/components/document-acknowledgement/acknowledgement-charts';
import {
  AcknowledgementTable, AcknowledgementInbox, ReminderPanel, LoadingSkeleton as AckSkeleton,
} from '@/components/document-acknowledgement/acknowledgement-ui';
import {
  exportAcknowledgementsCsv, exportAcknowledgementsExcel, logAckExported, logAckDashboardViewed,
  sendBulkReminders, escalateOverdue, recordDocumentView, recordReadConfirmation, acknowledgeDocument,
} from '@/lib/document-acknowledgement-service';
import type { AcknowledgementKpis } from '@/lib/document-acknowledgement-types';
import {
  getPendingAcknowledgements, getOverdueAcknowledgements, getRecentCompletions,
  getEmployeesNotAcknowledged, getRecentlyViewed, getRecentReadConfirmations, ACK_KPI_FILTER_MAP,
} from '@/lib/document-acknowledgement-records';
import { DMS_DEPARTMENTS, DOCUMENT_TYPES } from '@/lib/dms-types';
import { cn } from '@/lib/utils';

const KPI_ITEMS: { label: string; key: keyof AcknowledgementKpis; filterKey?: string; tone?: 'blue' | 'green' | 'amber' | 'red' }[] = [
  { label: 'Total Acknowledgements', key: 'totalAcknowledgements', tone: 'blue' },
  { label: 'Pending', key: 'pending', filterKey: 'pending', tone: 'amber' },
  { label: 'Completed', key: 'completed', filterKey: 'completed', tone: 'green' },
  { label: 'Viewed Only', key: 'viewedOnly', filterKey: 'viewed' },
  { label: 'Overdue', key: 'overdue', filterKey: 'overdue', tone: 'red' },
  { label: 'Expired', key: 'expired', filterKey: 'expired' },
  { label: 'Read Confirmed', key: 'readConfirmed', filterKey: 'read_confirmed' },
  { label: 'Training Pending', key: 'trainingPending', filterKey: 'training_pending', tone: 'amber' },
];

export function DocumentAcknowledgementPage() {
  return (<Suspense fallback={<LoadingSkeleton rows={8} />}><DocumentAcknowledgementContent /></Suspense>);
}

function DocumentAcknowledgementContent() {
  const searchParams = useSearchParams();
  const viewedLogged = useRef(false);
  const [activeKpi, setActiveKpi] = useState<string | null>(null);
  const {
    records, paginatedRecords, metrics, charts, filters, setFilters,
    loading, refreshing, error, refresh, actor, page, setPage, totalPages, pagination,
    selectedIds, toggleSelect, toggleSelectAll, clearSelection,
    canExport, canRemind, isReadOnly, ownOnly, canAcknowledge,
  } = useDocumentAcknowledgement();

  useEffect(() => {
    if (!viewedLogged.current && !loading && actor.id) {
      viewedLogged.current = true;
      void logAckDashboardViewed(actor);
    }
  }, [loading, actor.id, actor]);

  useEffect(() => {
    const kpi = searchParams.get('kpi');
    if (kpi && ACK_KPI_FILTER_MAP[kpi]) {
      setActiveKpi(kpi);
      setFilters((p) => ({ ...p, ...ACK_KPI_FILTER_MAP[kpi] }));
    }
  }, [searchParams, setFilters]);

  const handleExport = useCallback((format: 'csv' | 'excel' | 'print') => {
    if (!records.length) { toast.error('No acknowledgements to export'); return; }
    if (format === 'csv') exportAcknowledgementsCsv(records);
    else if (format === 'excel') exportAcknowledgementsExcel(records);
    else window.print();
    void logAckExported(actor, format, records.length);
    toast.success('Export complete');
  }, [records, actor]);

  const handleInboxAction = async (id: string, action: 'view' | 'read' | 'ack') => {
    try {
      if (action === 'view') {
        await recordDocumentView(id, actor);
        toast.success('Document view recorded');
      } else if (action === 'read') {
        await recordReadConfirmation(id, '', actor);
        toast.success('Read confirmation recorded');
      } else {
        const sig = window.prompt('Electronic signature (type your full name):');
        if (!sig) return;
        await acknowledgeDocument(id, { comments: '', electronic_signature: sig }, actor);
        toast.success('Document acknowledged');
      }
      refresh(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Action failed'); }
  };

  const inboxRecords = records.filter((r) =>
    ['Pending', 'Viewed', 'Read Confirmed', 'Overdue'].includes(r.acknowledgement_status) &&
    (r.employee_id === actor.id || !ownOnly),
  );

  if (loading && !records.length) return <AckSkeleton rows={8} />;
  if (error) return <ErrorCard message={error} onRetry={() => refresh()} />;

  return (
    <div className="space-y-6 animate-in fade-in print:space-y-4">
      <DmsPageHeader
        title="Document Acknowledgement & Read Confirmation"
        description="Track employee acknowledgement of controlled GMP documents with complete auditability."
        trail={[{ label: 'Acknowledgements' }]}
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

      {canRemind && (
        <ReminderPanel
          pendingCount={metrics.pending + metrics.overdue}
          disabled={refreshing}
          onRemind={async () => {
            const ids = selectedIds.length ? selectedIds : getPendingAcknowledgements(records).map((r) => r.id);
            const c = await sendBulkReminders(ids, actor);
            toast.success(`Sent ${c} reminder(s)`);
            clearSelection();
          }}
          onEscalate={async () => {
            const c = await escalateOverdue(actor);
            toast.success(`Escalated ${c} overdue acknowledgement(s)`);
            refresh(true);
          }}
        />
      )}

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Input placeholder="Search acknowledgements..." value={filters.search || ''} onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1); }} className="max-w-xs" />
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.status || ''} onChange={(e) => { setFilters({ ...filters, status: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Statuses</option>
              {['Pending', 'Viewed', 'Read Confirmed', 'Acknowledged', 'Overdue', 'Expired', 'Cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
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
            setFilters(active ? {} : ACK_KPI_FILTER_MAP[item.filterKey!] || {});
            setPage(1);
          }} className={cn('text-left', activeKpi === item.filterKey && 'ring-2 ring-blue-500 rounded-lg')}>
            <KpiCard label={item.label} value={metrics[item.key]} tone={item.tone} />
          </button>
        ) : (
          <KpiCard key={item.key} label={item.label} value={metrics[item.key]} tone={item.tone} />
        ))}
      </div>

      <AcknowledgementCharts charts={charts} />

      {canAcknowledge && inboxRecords.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Bell className="h-5 w-5" /> My Acknowledgement Inbox</h2>
          <AcknowledgementInbox records={inboxRecords.slice(0, 6)} onAction={(id, action) => void handleInboxAction(id, action)} />
        </div>
      )}

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="pending">Pending ({getPendingAcknowledgements(records).length})</TabsTrigger>
          <TabsTrigger value="overdue">Overdue ({getOverdueAcknowledgements(records).length})</TabsTrigger>
          <TabsTrigger value="completed">Recent Completions ({getRecentCompletions(records).length})</TabsTrigger>
          <TabsTrigger value="not-ack">Not Acknowledged ({getEmployeesNotAcknowledged(records).length})</TabsTrigger>
          <TabsTrigger value="viewed">Recently Viewed ({getRecentlyViewed(records).length})</TabsTrigger>
          <TabsTrigger value="read">Read Confirmations ({getRecentReadConfirmations(records).length})</TabsTrigger>
          <TabsTrigger value="all">All ({records.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card>
            <CardContent className="p-0">
              <AcknowledgementTable records={paginatedRecords} selectedIds={selectedIds} toggleSelect={toggleSelect} toggleSelectAll={toggleSelectAll} isReadOnly={isReadOnly} />
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
          { v: 'pending', d: getPendingAcknowledgements(records) },
          { v: 'overdue', d: getOverdueAcknowledgements(records) },
          { v: 'completed', d: getRecentCompletions(records) },
          { v: 'not-ack', d: getEmployeesNotAcknowledged(records) },
          { v: 'viewed', d: getRecentlyViewed(records) },
          { v: 'read', d: getRecentReadConfirmations(records) },
        ].map(({ v, d }) => (
          <TabsContent key={v} value={v}>
            <Card>
              <CardContent className="p-0">
                {v === 'overdue' && d.length > 0 && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/20 border-b flex items-center gap-2 text-sm text-red-700">
                    <AlertTriangle className="h-4 w-4" /> {d.length} overdue acknowledgement(s) require attention
                  </div>
                )}
                <AcknowledgementTable records={d.slice(0, 20)} isReadOnly={isReadOnly} compact />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
