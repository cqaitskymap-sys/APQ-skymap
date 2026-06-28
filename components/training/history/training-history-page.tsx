'use client';

import { useMemo, useState } from 'react';
import {
  RefreshCw, AlertTriangle, ChevronLeft, ChevronRight, LayoutGrid, List, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import type { ColumnDef } from '@/components/admin/admin-data-table';
import { TmsPageHeader } from '@/components/training/tms-page-header';
import { useTrainingHistory } from '@/hooks/use-training-history';
import type { HistoryFilters, TrainingHistoryEntry } from '@/lib/training-history-types';
import {
  exportHistoryCsv, openHistoryPrint, logHistoryExported,
} from '@/lib/training-history-service';
import { EmployeeProfileCard, HistoryStatusBadge } from './employee-profile-card';
import { HistoryFilterPanel } from './history-filter-panel';
import { HistoryDashboardCharts } from './history-dashboard-charts';
import { HistoryExportMenu } from './history-export-menu';
import { TrainingTimeline } from './training-timeline';
import { HistoryCertificateCard } from './history-certificate-card';
import { ComplianceGauge } from '@/components/training/retraining/compliance-gauge';
import { HistoryEntryCard } from './history-entry-card';
import { cn } from '@/lib/utils';

const KPI_CONFIG = [
  { label: 'Total Trainings', key: 'totalTrainings' as const, tone: 'blue' as const },
  { label: 'Completed', key: 'completed' as const, tone: 'green' as const },
  { label: 'Pending', key: 'pending' as const, tone: 'amber' as const },
  { label: 'Failed', key: 'failed' as const, tone: 'red' as const },
  { label: 'Overdue', key: 'overdue' as const, tone: 'red' as const },
  { label: 'Certificates', key: 'certificates' as const, tone: 'blue' as const },
  { label: 'Expired Certs', key: 'expiredCertificates' as const, tone: 'red' as const },
  { label: 'Upcoming Retrain', key: 'upcomingRetraining' as const, tone: 'amber' as const },
  { label: 'Avg Score', key: 'averageAssessmentScore' as const, tone: 'green' as const, suffix: '%' },
  { label: 'Competency', key: 'competencyScore' as const, tone: 'green' as const, suffix: '%' },
];

interface TrainingHistoryPageProps {
  defaultView?: 'table' | 'timeline' | 'cards';
}

export function TrainingHistoryPage({ defaultView = 'table' }: TrainingHistoryPageProps) {
  const [filters, setFilters] = useState<HistoryFilters>({});
  const [viewMode, setViewMode] = useState<'table' | 'timeline' | 'cards'>(defaultView);
  const [page, setPage] = useState(1);
  const [detailTab, setDetailTab] = useState('history');

  const {
    data, loading, refreshing, error, refresh, actor, employees,
    selectedEmployeeId, setSelectedEmployeeId, effectiveEmployeeId,
    canView, isReadOnly, isEmployeeView, isDepartmentView,
  } = useTrainingHistory(undefined, filters);

  const paginated = useMemo(() => {
    if (!data) return [];
    const size = 15;
    const start = (page - 1) * size;
    return data.history.slice(start, start + size);
  }, [data, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.history.length / 15)) : 1;

  const historyColumns: ColumnDef<TrainingHistoryEntry>[] = [
    { key: 'number', header: 'Training #', render: (r) => <span className="font-mono text-xs">{r.training_number}</span> },
    { key: 'topic', header: 'Topic', render: (r) => <span className="text-xs">{r.training_topic}</span> },
    { key: 'type', header: 'Type', render: (r) => r.training_type },
    { key: 'trainer', header: 'Trainer', render: (r) => r.trainer || '—' },
    { key: 'completed', header: 'Completed', render: (r) => r.completion_date || '—' },
    { key: 'score', header: 'Score', render: (r) => r.assessment_score ?? '—' },
    { key: 'result', header: 'Result', render: (r) => r.training_result || '—' },
    {
      key: 'status', header: 'Status',
      render: (r) => (
        <span className={cn(r.is_overdue && 'animate-pulse')}>
          <HistoryStatusBadge status={String(r.training_status)} />
        </span>
      ),
    },
  ];

  const handleEmployeeChange = (id: string) => {
    setSelectedEmployeeId(id);
    setFilters((f) => ({ ...f, employee_id: id }));
    setPage(1);
  };

  const handleExport = (format: string) => {
    if (!data) return;
    exportHistoryCsv(data.history, data.profile?.employee_name || 'employee');
    logHistoryExported(actor, effectiveEmployeeId, format, data.history.length);
    toast.success(`${format} exported`);
  };

  if (!canView) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>You do not have permission to view employee training history.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <TmsPageHeader
        title="Employee Training History"
        description="Complete employee GMP training records and competency history."
        trail={[{ label: 'Employee Training History' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={refresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <HistoryExportMenu
              canExport={!isReadOnly}
              onDownload={() => { if (data) { openHistoryPrint(data); toast.success('Inspection report opened'); } }}
              onCsv={() => handleExport('CSV')}
              onExcel={() => handleExport('Excel')}
              onPrint={() => { if (data) openHistoryPrint(data); }}
            />
          </div>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="text-xs">FDA / MHRA Ready</Badge>
        <Badge variant="outline" className="text-xs">WHO GMP</Badge>
        <Badge variant="outline" className="text-xs">PIC/S Compliant</Badge>
        <Badge variant="outline" className="text-xs">EU GMP Annex 11</Badge>
      </div>

      {isReadOnly && <Alert><AlertTitle>Read-Only</AlertTitle><AlertDescription>Auditor view — history cannot be modified.</AlertDescription></Alert>}
      {isEmployeeView && <Alert><AlertDescription>Viewing your own training history.</AlertDescription></Alert>}
      {error && <ErrorCard message={error} onRetry={refresh} />}

      {!isEmployeeView && (
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[240px]">
            <Label>Employee</Label>
            <Select value={effectiveEmployeeId || 'none'} onValueChange={handleEmployeeChange}>
              <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name} — {e.department}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <HistoryFilterPanel
        filters={filters}
        onChange={(f) => { setFilters(f); setPage(1); }}
        employees={employees}
        showDepartment={!isEmployeeView}
        showEmployee={!isEmployeeView && !isDepartmentView}
      />

      {loading ? <LoadingSkeleton rows={8} /> : data ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-1">
              <EmployeeProfileCard profile={data.profile} />
            </div>
            <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-5 gap-3">
              {KPI_CONFIG.map(({ label, key, tone, suffix }) => (
                <KpiCard key={key} label={label} value={`${data.kpis[key]}${suffix ?? ''}`} tone={tone} />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant={viewMode === 'table' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('table')}>
              <List className="h-4 w-4 mr-1" /> Table
            </Button>
            <Button variant={viewMode === 'timeline' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('timeline')}>
              <Clock className="h-4 w-4 mr-1" /> Timeline
            </Button>
            <Button variant={viewMode === 'cards' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('cards')}>
              <LayoutGrid className="h-4 w-4 mr-1" /> Cards
            </Button>
          </div>

          <Tabs value={detailTab} onValueChange={setDetailTab}>
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="history">Training History</TabsTrigger>
              <TabsTrigger value="assessments">Assessments</TabsTrigger>
              <TabsTrigger value="competency">Competency</TabsTrigger>
              <TabsTrigger value="certificates">Certificates</TabsTrigger>
              <TabsTrigger value="retraining">Retraining</TabsTrigger>
              <TabsTrigger value="sop">SOP Revisions</TabsTrigger>
              <TabsTrigger value="matrix">Matrix Mapping</TabsTrigger>
              <TabsTrigger value="charts">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="history" className="mt-4 space-y-4">
              {viewMode === 'timeline' && <TrainingTimeline events={data.timeline} />}
              {viewMode === 'cards' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {data.history.slice(0, 12).map((h) => (
                    <HistoryEntryCard key={h.id} entry={h} />
                  ))}
                </div>
              )}
              {viewMode === 'table' && (
                <>
                  <ResponsiveDataTable
                    data={paginated}
                    columns={historyColumns}
                    emptyMessage="No training history found"
                    mobileTitleKey="training_topic"
                    mobileSubtitleKey="training_number"
                  />
                  {totalPages > 1 && (
                    <div className="flex justify-center gap-2">
                      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                      <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
                      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="assessments" className="mt-4">
              <ResponsiveDataTable
                data={data.assessments}
                columns={[
                  { key: 'num', header: 'Training #', render: (r) => r.training_number },
                  { key: 'topic', header: 'Topic', render: (r) => r.training_topic },
                  { key: 'score', header: 'Score', render: (r) => r.assessment_score ?? '—' },
                  { key: 'pass', header: 'Pass Score', render: (r) => r.passing_score },
                  { key: 'result', header: 'Result', render: (r) => r.result },
                  { key: 'date', header: 'Date', render: (r) => r.assessed_at?.slice(0, 10) },
                  { key: 'trainer', header: 'Trainer', render: (r) => r.trainer },
                ]}
                emptyMessage="No assessment history"
                mobileTitleKey="training_topic"
                mobileSubtitleKey="training_number"
              />
            </TabsContent>

            <TabsContent value="competency" className="mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <ComplianceGauge percent={data.kpis.competencyScore} label="Competency Score" />
                <div className="lg:col-span-3">
                  <ResponsiveDataTable
                    data={data.competency}
                    columns={[
                      { key: 'skill', header: 'Skill', render: (r) => r.skill },
                      { key: 'required', header: 'Required', render: (r) => r.required_level },
                      { key: 'current', header: 'Current', render: (r) => r.current_level },
                      { key: 'gap', header: 'Gap', render: (r) => r.gap || 'None' },
                      { key: 'updated', header: 'Updated', render: (r) => r.updated_at?.slice(0, 10) },
                    ]}
                    emptyMessage="No competency records"
                    mobileTitleKey="skill"
                    mobileSubtitleKey="current_level"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="certificates" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.certificates.length === 0 ? (
                  <p className="text-sm text-muted-foreground col-span-full text-center py-8">No certificates on file</p>
                ) : data.certificates.map((c) => <HistoryCertificateCard key={c.id} cert={c} />)}
              </div>
            </TabsContent>

            <TabsContent value="retraining" className="mt-4">
              <ResponsiveDataTable
                data={data.retraining}
                columns={[
                  { key: 'num', header: 'Retraining #', render: (r) => r.retraining_number },
                  { key: 'topic', header: 'Topic', render: (r) => r.training_topic },
                  { key: 'trigger', header: 'Trigger', render: (r) => r.trigger_type },
                  { key: 'due', header: 'Due', render: (r) => r.due_date },
                  { key: 'status', header: 'Status', render: (r) => <HistoryStatusBadge status={r.status} /> },
                  { key: 'completed', header: 'Completed', render: (r) => r.completion_date || '—' },
                ]}
                emptyMessage="No retraining history"
                mobileTitleKey="training_topic"
                mobileSubtitleKey="retraining_number"
              />
            </TabsContent>

            <TabsContent value="sop" className="mt-4">
              <ResponsiveDataTable
                data={data.sopRevisions}
                columns={[
                  { key: 'sop', header: 'SOP #', render: (r) => r.sop_number },
                  { key: 'ver', header: 'Version', render: (r) => r.document_version },
                  { key: 'topic', header: 'Training Topic', render: (r) => r.training_topic },
                  { key: 'effective', header: 'Effective', render: (r) => r.effective_date },
                  { key: 'status', header: 'Status', render: (r) => <HistoryStatusBadge status={r.status} /> },
                ]}
                emptyMessage="No SOP revision history"
                mobileTitleKey="sop_number"
                mobileSubtitleKey="training_topic"
              />
            </TabsContent>

            <TabsContent value="matrix" className="mt-4">
              <ResponsiveDataTable
                data={data.matrixMapping}
                columns={[
                  { key: 'topic', header: 'Training Topic', render: (r) => r.training_topic },
                  { key: 'type', header: 'Type', render: (r) => r.training_type },
                  { key: 'doc', header: 'Document', render: (r) => r.document_number },
                  { key: 'freq', header: 'Frequency', render: (r) => r.training_frequency },
                  { key: 'mapped', header: 'Completed', render: (r) => r.mapped ? '✓ Yes' : '✗ No' },
                  { key: 'status', header: 'Matrix Status', render: (r) => r.status },
                ]}
                emptyMessage="No matrix mappings for this employee"
                mobileTitleKey="training_topic"
                mobileSubtitleKey="training_type"
              />
            </TabsContent>

            <TabsContent value="charts" className="mt-4">
              <HistoryDashboardCharts charts={data.charts} />
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  );
}
