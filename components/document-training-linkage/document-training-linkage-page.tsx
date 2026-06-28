'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, RefreshCw, Printer, UserPlus, Bell, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { DmsPageHeader } from '@/components/dms/dms-page-header';
import { useDocumentTrainingLinkage } from '@/hooks/use-document-training-linkage';
import { DtlCharts } from '@/components/document-training-linkage/dtl-charts';
import {
  TrainingAssignmentTable, TrainingLinkCard, LoadingSkeleton as DtlSkeleton,
} from '@/components/document-training-linkage/dtl-ui';
import { RetrainingWizard } from '@/components/document-training-linkage/retraining-wizard';
import {
  exportTrainingLinksCsv, exportTrainingLinksExcel, logTrainingLinkageExported,
  logTrainingLinkageDashboardViewed, bulkAssignTrainingLinks, bulkSendReminders,
  assignTrainingForLink, createRetrainingForLink,
} from '@/lib/document-training-linkage-service';
import type { TrainingLinkageKpis, DocumentTrainingLinkRecord } from '@/lib/document-training-linkage-types';
import { TRAINING_LINK_STATUSES, TRAINING_LINK_TYPES, ASSIGNMENT_METHODS } from '@/lib/document-training-linkage-types';
import type { RetrainingInput } from '@/lib/document-training-linkage-schemas';
import {
  getRecentAssignments, getOverdueTraining, getUpcomingDue, getRetrainingQueue,
  getPendingQualification, getRecentCompletions, DTL_KPI_FILTER_MAP,
} from '@/lib/document-training-linkage-records';
import { DMS_DEPARTMENTS, DOCUMENT_TYPES } from '@/lib/dms-types';
import { cn } from '@/lib/utils';

const KPI_ITEMS: { label: string; key: keyof TrainingLinkageKpis; filterKey?: string; tone?: 'blue' | 'green' | 'amber' | 'red' }[] = [
  { label: 'Linked Documents', key: 'linkedDocuments', filterKey: 'linked', tone: 'blue' },
  { label: 'Active Assignments', key: 'activeAssignments', filterKey: 'active', tone: 'amber' },
  { label: 'Completed Training', key: 'completedTraining', filterKey: 'completed', tone: 'green' },
  { label: 'Overdue Training', key: 'overdueTraining', filterKey: 'overdue', tone: 'red' },
  { label: 'Retraining Assignments', key: 'retrainingAssignments', filterKey: 'retraining', tone: 'amber' },
  { label: 'Awaiting Qualification', key: 'awaitingQualification', tone: 'blue' },
  { label: 'Compliance %', key: 'compliancePct', tone: 'green' },
  { label: 'Acknowledgements Pending', key: 'acknowledgementsPending', tone: 'amber' },
];

export function DocumentTrainingLinkagePage() {
  return (<Suspense fallback={<LoadingSkeleton rows={8} />}><DocumentTrainingLinkageContent /></Suspense>);
}

function DocumentTrainingLinkageContent() {
  const searchParams = useSearchParams();
  const viewedLogged = useRef(false);
  const [activeKpi, setActiveKpi] = useState<string | null>(null);
  const [retrainRecord, setRetrainRecord] = useState<DocumentTrainingLinkRecord | null>(null);

  const {
    records, paginatedRecords, metrics, charts, filters, setFilters,
    loading, refreshing, error, refresh, actor, page, setPage, totalPages, pagination,
    selectedIds, toggleSelect, toggleSelectAll, clearSelection,
    canExport, canManage, canBulk, isReadOnly, canView,
  } = useDocumentTrainingLinkage();

  useEffect(() => {
    if (!viewedLogged.current && !loading && actor.id) {
      viewedLogged.current = true;
      void logTrainingLinkageDashboardViewed(actor);
    }
  }, [loading, actor.id, actor]);

  useEffect(() => {
    const kpi = searchParams.get('kpi');
    if (kpi && DTL_KPI_FILTER_MAP[kpi]) {
      setActiveKpi(kpi);
      setFilters((p) => ({ ...p, ...DTL_KPI_FILTER_MAP[kpi] }));
    }
  }, [searchParams, setFilters]);

  const handleExport = useCallback((format: 'csv' | 'excel' | 'print') => {
    if (!records.length) { toast.error('No records to export'); return; }
    if (format === 'csv') exportTrainingLinksCsv(records);
    else if (format === 'excel') exportTrainingLinksExcel(records);
    else window.print();
    void logTrainingLinkageExported(actor, format, records.length);
    toast.success('Export complete');
  }, [records, actor]);

  const handleBulkAssign = async () => {
    if (!selectedIds.length) { toast.error('Select links first'); return; }
    const count = await bulkAssignTrainingLinks(selectedIds, actor);
    toast.success(`${count} link(s) assigned`);
    clearSelection();
    refresh(true);
  };

  const handleBulkReminder = async () => {
    if (!selectedIds.length) { toast.error('Select links first'); return; }
    const count = await bulkSendReminders(selectedIds, actor);
    toast.success(`${count} reminder(s) sent`);
    clearSelection();
  };

  const handleAssign = async (id: string) => {
    try {
      const count = await assignTrainingForLink(id, actor);
      toast.success(`Training assigned to ${count} employee(s)`);
      refresh(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Assignment failed'); }
  };

  const handleRetraining = async (input: RetrainingInput) => {
    try {
      await createRetrainingForLink(input, actor);
      toast.success('Retraining created');
      setRetrainRecord(null);
      refresh(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Retraining failed'); }
  };

  if (!canView) return <ErrorCard message="You do not have access to document training linkage." />;
  if (loading && !records.length) return <DtlSkeleton rows={8} />;
  if (error) return <ErrorCard message={error} onRetry={() => refresh()} />;

  const pendingLinks = records.filter((r) => r.status === 'Pending Assignment').slice(0, 6);

  return (
    <div className="space-y-6 animate-in fade-in print:space-y-4">
      <DmsPageHeader
        title="Document Training Linkage"
        description="Automatically connect controlled GMP documents with employee training, qualification, and competency management."
        trail={[{ label: 'Document Training Linkage' }]}
        actions={<>
          <Button variant="outline" size="sm" onClick={() => refresh(true)} disabled={refreshing}>
            <RefreshCw className={cn('h-4 w-4 mr-1', refreshing && 'animate-spin')} /> Refresh
          </Button>
          {canBulk && selectedIds.length > 0 && (<>
            <Button variant="outline" size="sm" onClick={() => void handleBulkAssign()}>
              <UserPlus className="h-4 w-4 mr-1" /> Bulk Assign ({selectedIds.length})
            </Button>
            <Button variant="outline" size="sm" onClick={() => void handleBulkReminder()}>
              <Bell className="h-4 w-4 mr-1" /> Remind
            </Button>
          </>)}
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
              {TRAINING_LINK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.department || ''} onChange={(e) => { setFilters({ ...filters, department: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Departments</option>
              {DMS_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.training_type || ''} onChange={(e) => { setFilters({ ...filters, training_type: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Training Types</option>
              {TRAINING_LINK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.assignment_method || ''} onChange={(e) => { setFilters({ ...filters, assignment_method: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Methods</option>
              {ASSIGNMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {KPI_ITEMS.map((item) => item.filterKey ? (
          <button key={item.key} type="button" onClick={() => {
            const active = activeKpi === item.filterKey;
            setActiveKpi(active ? null : item.filterKey!);
            setFilters(active ? {} : DTL_KPI_FILTER_MAP[item.filterKey!] || {});
            setPage(1);
          }} className={cn('text-left', activeKpi === item.filterKey && 'ring-2 ring-emerald-500 rounded-lg')}>
            <KpiCard label={item.label} value={metrics[item.key]} tone={item.tone} />
          </button>
        ) : (
          <KpiCard key={item.key} label={item.label} value={metrics[item.key]} tone={item.tone} />
        ))}
      </div>

      <DtlCharts charts={charts} />

      {canManage && pendingLinks.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Pending Assignment</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pendingLinks.map((r) => (
              <div key={r.id} className="relative">
                <TrainingLinkCard record={r} />
                <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => void handleAssign(r.id)}>Assign Training</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Tabs defaultValue="recent" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="recent">Recent ({getRecentAssignments(records).length})</TabsTrigger>
          <TabsTrigger value="overdue">Overdue ({getOverdueTraining(records).length})</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming ({getUpcomingDue(records).length})</TabsTrigger>
          <TabsTrigger value="retraining">Retraining ({getRetrainingQueue(records).length})</TabsTrigger>
          <TabsTrigger value="qualification">Qualification ({getPendingQualification(records).length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({getRecentCompletions(records).length})</TabsTrigger>
          <TabsTrigger value="all">All ({records.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card>
            <CardContent className="p-0">
              <TrainingAssignmentTable records={paginatedRecords} selectedIds={selectedIds} toggleSelect={toggleSelect} toggleSelectAll={toggleSelectAll} isReadOnly={isReadOnly} />
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
          { v: 'recent', d: getRecentAssignments(records) },
          { v: 'overdue', d: getOverdueTraining(records) },
          { v: 'upcoming', d: getUpcomingDue(records) },
          { v: 'retraining', d: getRetrainingQueue(records) },
          { v: 'qualification', d: getPendingQualification(records) },
          { v: 'completed', d: getRecentCompletions(records) },
        ].map(({ v, d }) => (
          <TabsContent key={v} value={v}>
            <Card>
              <CardContent className="p-0">
                <TrainingAssignmentTable records={d.slice(0, 20)} isReadOnly={isReadOnly} compact />
                {v === 'retraining' && canManage && d.length > 0 && (
                  <div className="p-3 border-t flex gap-2 flex-wrap">
                    {d.slice(0, 3).map((r) => (
                      <Button key={r.id} variant="outline" size="sm" onClick={() => setRetrainRecord(r)}>
                        <RotateCcw className="h-3 w-3 mr-1" /> Retrain {r.document_number}
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <RetrainingWizard
        open={Boolean(retrainRecord)}
        onOpenChange={(o) => { if (!o) setRetrainRecord(null); }}
        documentNumber={retrainRecord?.document_number}
        linkId={retrainRecord?.id}
        onSubmit={(input) => void handleRetraining(input)}
      />
    </div>
  );
}
