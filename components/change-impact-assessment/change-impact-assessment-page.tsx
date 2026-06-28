'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, RefreshCw, Printer, Send, CheckCircle, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { DmsPageHeader } from '@/components/dms/dms-page-header';
import { useChangeImpactAssessment } from '@/hooks/use-change-impact-assessment';
import { CiaCharts } from '@/components/change-impact-assessment/cia-charts';
import {
  ImpactAssessmentTable, ImpactSummaryCard, DependencyGraph,
  ValidationImpactPanel, TrainingImpactPanel, LoadingSkeleton as CiaSkeleton,
} from '@/components/change-impact-assessment/cia-ui';
import { ElectronicSignatureDialog } from '@/components/change-impact-assessment/electronic-signature-dialog';
import {
  exportImpactAssessmentsCsv, exportImpactAssessmentsExcel, logChangeImpactExported,
  logChangeImpactDashboardViewed, submitForReview, completeReview, approveImpactAssessment,
} from '@/lib/change-impact-assessment-service';
import type { ChangeImpactKpis, DocumentChangeImpactRecord } from '@/lib/change-impact-assessment-types';
import { ASSESSMENT_STATUSES, ASSESSMENT_TYPES, IMPACT_RATINGS } from '@/lib/change-impact-assessment-types';
import type { ApproveImpactInput } from '@/lib/change-impact-assessment-schemas';
import {
  getOpenAssessments, getCriticalAssessments, getPendingApprovals, getRecentAssessments,
  getValidationRequired, getRetrainingQueue, CIA_KPI_FILTER_MAP,
} from '@/lib/change-impact-assessment-records';
import { DMS_DEPARTMENTS } from '@/lib/dms-types';
import { cn } from '@/lib/utils';

const KPI_ITEMS: { label: string; key: keyof ChangeImpactKpis; filterKey?: string; tone?: 'blue' | 'green' | 'amber' | 'red' }[] = [
  { label: 'Open Assessments', key: 'openAssessments', filterKey: 'open', tone: 'amber' },
  { label: 'Approved', key: 'approvedAssessments', filterKey: 'approved', tone: 'green' },
  { label: 'Critical Impacts', key: 'criticalImpacts', filterKey: 'critical', tone: 'red' },
  { label: 'Pending Reviews', key: 'pendingReviews', filterKey: 'review', tone: 'blue' },
  { label: 'Pending Approvals', key: 'pendingApprovals', filterKey: 'approval', tone: 'amber' },
  { label: 'Validation Required', key: 'validationRequired', filterKey: 'validation', tone: 'amber' },
  { label: 'Retraining Required', key: 'retrainingRequired', filterKey: 'retraining', tone: 'blue' },
  { label: 'CAPAs Generated', key: 'capasGenerated', tone: 'red' },
];

export function ChangeImpactAssessmentPage() {
  return (<Suspense fallback={<LoadingSkeleton rows={8} />}><ChangeImpactAssessmentContent /></Suspense>);
}

function ChangeImpactAssessmentContent() {
  const searchParams = useSearchParams();
  const viewedLogged = useRef(false);
  const [activeKpi, setActiveKpi] = useState<string | null>(null);
  const [approveRecord, setApproveRecord] = useState<DocumentChangeImpactRecord | null>(null);
  const [detailRecord, setDetailRecord] = useState<DocumentChangeImpactRecord | null>(null);

  const {
    records, paginatedRecords, metrics, charts, filters, setFilters,
    loading, refreshing, error, refresh, actor, page, setPage, totalPages, pagination,
    selectedIds, toggleSelect, toggleSelectAll,
    canExport, canManage, canApprove, isReadOnly, canView,
  } = useChangeImpactAssessment();

  useEffect(() => {
    if (!viewedLogged.current && !loading && actor.id) {
      viewedLogged.current = true;
      void logChangeImpactDashboardViewed(actor);
    }
  }, [loading, actor.id, actor]);

  useEffect(() => {
    const kpi = searchParams.get('kpi');
    if (kpi && CIA_KPI_FILTER_MAP[kpi]) {
      setActiveKpi(kpi);
      setFilters((p) => ({ ...p, ...CIA_KPI_FILTER_MAP[kpi] }));
    }
  }, [searchParams, setFilters]);

  const handleExport = useCallback((format: 'csv' | 'excel' | 'print') => {
    if (!records.length) { toast.error('No records to export'); return; }
    if (format === 'csv') exportImpactAssessmentsCsv(records);
    else if (format === 'excel') exportImpactAssessmentsExcel(records);
    else window.print();
    void logChangeImpactExported(actor, format, records.length);
    toast.success('Export complete');
  }, [records, actor]);

  const handleSubmitReview = async (id: string) => {
    try {
      await submitForReview(id, actor);
      toast.success('Submitted for review');
      refresh(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Submit failed'); }
  };

  const handleCompleteReview = async (id: string) => {
    try {
      await completeReview(id, actor);
      toast.success('Review completed — pending approval');
      refresh(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Review failed'); }
  };

  const handleApprove = async (input: ApproveImpactInput) => {
    if (!approveRecord) return;
    try {
      await approveImpactAssessment(approveRecord.id, input, actor);
      toast.success('Assessment approved');
      setApproveRecord(null);
      refresh(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Approval failed'); }
  };

  if (!canView) return <ErrorCard message="You do not have access to change impact assessment." />;
  if (loading && !records.length) return <CiaSkeleton rows={8} />;
  if (error) return <ErrorCard message={error} onRetry={() => refresh()} />;

  const draftRecords = records.filter((r) => r.assessment_status === 'Draft').slice(0, 4);

  return (
    <div className="space-y-6 animate-in fade-in print:space-y-4">
      <DmsPageHeader
        title="Change Impact Assessment"
        description="Evaluate and document the impact of controlled document changes before implementation."
        trail={[{ label: 'Change Impact Assessment' }]}
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
            <Input placeholder="Search assessments..." value={filters.search || ''} onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1); }} className="max-w-xs" />
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.status || ''} onChange={(e) => { setFilters({ ...filters, status: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Statuses</option>
              {ASSESSMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.department || ''} onChange={(e) => { setFilters({ ...filters, department: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Departments</option>
              {DMS_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.assessment_type || ''} onChange={(e) => { setFilters({ ...filters, assessment_type: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Types</option>
              {ASSESSMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.impact_rating || ''} onChange={(e) => { setFilters({ ...filters, impact_rating: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Impact Ratings</option>
              {IMPACT_RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {KPI_ITEMS.map((item) => item.filterKey ? (
          <button key={item.key} type="button" onClick={() => {
            const active = activeKpi === item.filterKey;
            setActiveKpi(active ? null : item.filterKey!);
            setFilters(active ? {} : CIA_KPI_FILTER_MAP[item.filterKey!] || {});
            setPage(1);
          }} className={cn('text-left', activeKpi === item.filterKey && 'ring-2 ring-emerald-500 rounded-lg')}>
            <KpiCard label={item.label} value={metrics[item.key]} tone={item.tone} />
          </button>
        ) : (
          <KpiCard key={item.key} label={item.label} value={metrics[item.key]} tone={item.tone} />
        ))}
      </div>

      <CiaCharts charts={charts} />

      {canManage && draftRecords.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Draft Assessments</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {draftRecords.map((r) => (
              <div key={r.id}>
                <ImpactSummaryCard record={r} />
                <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => void handleSubmitReview(r.id)}>
                  <Send className="h-3 w-3 mr-1" /> Submit for Review
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {detailRecord && (
        <Card>
          <CardContent className="pt-4 space-y-4">
            <div className="flex justify-between items-start">
              <h3 className="font-semibold">Dependency Analysis — {detailRecord.document_number}</h3>
              <Button variant="ghost" size="sm" onClick={() => setDetailRecord(null)}>Close</Button>
            </div>
            <DependencyGraph dependencies={detailRecord.dependencies} />
            <div className="grid gap-3 sm:grid-cols-2">
              <ValidationImpactPanel record={detailRecord} />
              <TrainingImpactPanel record={detailRecord} />
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="open" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="open">Open ({getOpenAssessments(records).length})</TabsTrigger>
          <TabsTrigger value="critical">Critical ({getCriticalAssessments(records).length})</TabsTrigger>
          <TabsTrigger value="approval">Pending Approval ({getPendingApprovals(records).length})</TabsTrigger>
          <TabsTrigger value="validation">Validation ({getValidationRequired(records).length})</TabsTrigger>
          <TabsTrigger value="retraining">Retraining ({getRetrainingQueue(records).length})</TabsTrigger>
          <TabsTrigger value="recent">Recent ({getRecentAssessments(records).length})</TabsTrigger>
          <TabsTrigger value="all">All ({records.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card>
            <CardContent className="p-0">
              <ImpactAssessmentTable records={paginatedRecords} selectedIds={selectedIds} toggleSelect={toggleSelect} toggleSelectAll={toggleSelectAll} isReadOnly={isReadOnly} />
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
          { v: 'open', d: getOpenAssessments(records) },
          { v: 'critical', d: getCriticalAssessments(records) },
          { v: 'approval', d: getPendingApprovals(records) },
          { v: 'validation', d: getValidationRequired(records) },
          { v: 'retraining', d: getRetrainingQueue(records) },
          { v: 'recent', d: getRecentAssessments(records) },
        ].map(({ v, d }) => (
          <TabsContent key={v} value={v}>
            <Card>
              <CardContent className="p-0">
                <ImpactAssessmentTable records={d.slice(0, 20)} isReadOnly={isReadOnly} compact />
                <div className="p-3 border-t flex gap-2 flex-wrap">
                  {d.slice(0, 3).map((r) => (
                    <Button key={r.id} variant="outline" size="sm" onClick={() => setDetailRecord(r)}>
                      <Eye className="h-3 w-3 mr-1" /> {r.document_number}
                    </Button>
                  ))}
                  {v === 'open' && canManage && d.filter((r) => r.assessment_status === 'In Review').slice(0, 2).map((r) => (
                    <Button key={`rev-${r.id}`} size="sm" onClick={() => void handleCompleteReview(r.id)}>Complete Review</Button>
                  ))}
                  {v === 'approval' && canApprove && d.slice(0, 2).map((r) => (
                    <Button key={`app-${r.id}`} size="sm" onClick={() => setApproveRecord(r)}>
                      <CheckCircle className="h-3 w-3 mr-1" /> Approve
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <ElectronicSignatureDialog
        open={Boolean(approveRecord)}
        onOpenChange={(o) => { if (!o) setApproveRecord(null); }}
        record={approveRecord}
        onApprove={(input) => void handleApprove(input)}
      />
    </div>
  );
}
