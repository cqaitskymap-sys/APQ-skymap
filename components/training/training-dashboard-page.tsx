'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Download, Eye, FileSpreadsheet, FileText, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import type { ColumnDef } from '@/components/admin/admin-data-table';
import { TmsPageHeader } from '@/components/training/tms-page-header';
import { TmsStatusBadge } from '@/components/training/tms-sub-nav';
import { TrainingDashboardCharts } from '@/components/training/training-dashboard-charts';
import { TrainingDashboardFiltersBar } from '@/components/training/training-dashboard-filters';
import { TrainingActivityTimeline } from '@/components/training/training-dashboard-activity';
import { ComplianceGauge } from '@/components/training/retraining/compliance-gauge';
import { useTrainingDashboard } from '@/hooks/use-training-dashboard';
import type { TrainingDashboardKpis } from '@/lib/training-dashboard-types';
import type {
  RecentAssignmentRow, OverdueTrainingRow, EffectivenessPendingRow,
} from '@/lib/training-dashboard-records';
import {
  logTrainingDashboardExport,
  logTrainingDashboardViewed,
  openTrainingDashboardPdfPlaceholder,
  exportTrainingDashboardCsv,
} from '@/lib/training-dashboard-service';

const KPI_ITEMS: {
  label: string;
  key: keyof TrainingDashboardKpis;
  suffix?: string;
  tone?: 'blue' | 'green' | 'amber' | 'red';
}[] = [
  { label: 'Total Trainings', key: 'totalTrainings', tone: 'blue' },
  { label: 'Assigned Trainings', key: 'assignedTrainings', tone: 'blue' },
  { label: 'Completed Trainings', key: 'completedTrainings', tone: 'green' },
  { label: 'Pending Trainings', key: 'pendingTrainings', tone: 'amber' },
  { label: 'Overdue Trainings', key: 'overdueTrainings', tone: 'red' },
  { label: 'SOP Trainings', key: 'sopTrainings', tone: 'blue' },
  { label: 'Induction Trainings', key: 'inductionTrainings', tone: 'blue' },
  { label: 'Refresher Trainings', key: 'refresherTrainings', tone: 'amber' },
  { label: 'Effectiveness Pending', key: 'effectivenessPending', tone: 'amber' },
  { label: 'Effective Trainings', key: 'effectiveTrainings', tone: 'green' },
  { label: 'Not Effective', key: 'notEffectiveTrainings', tone: 'red' },
  { label: 'Training Compliance %', key: 'trainingCompliancePercent', suffix: '%', tone: 'green' },
  { label: 'Department Compliance %', key: 'departmentCompliancePercent', suffix: '%', tone: 'green' },
  { label: 'Users Not Trained', key: 'usersNotTrained', tone: 'red' },
  { label: 'Due This Week', key: 'trainingDueThisWeek', tone: 'amber' },
];

function viewAction(id: string) {
  return (
    <Link href={`/qms/training/assignments?highlight=${id}`}>
      <Button variant="ghost" size="sm" aria-label="View assignment"><Eye className="h-4 w-4" /></Button>
    </Link>
  );
}

function effectivenessAction(id: string) {
  return (
    <Link href={`/qms/training/effectiveness?highlight=${id}`}>
      <Button variant="ghost" size="sm" aria-label="Evaluate"><Eye className="h-4 w-4" /></Button>
    </Link>
  );
}

export function TrainingManagementDashboardPage() {
  const viewedLogged = useRef(false);
  const {
    data, filters, setFilters, employees, loading, refreshing, error, refresh,
    actor, showDepartmentFilter, showEmployeeFilter,
    canView, canExport, canManage, isReadOnly, isDepartmentView, isEmployeeView,
  } = useTrainingDashboard();

  const trainers = useMemo(() => {
    const set = new Set<string>();
    data?.recentAssignments.forEach((r) => { if (r.trainer) set.add(r.trainer); });
    return Array.from(set);
  }, [data?.recentAssignments]);

  const designations = useMemo(() => {
    const set = new Set(employees.map((e) => e.designation).filter(Boolean));
    return Array.from(set);
  }, [employees]);

  useEffect(() => {
    if (!viewedLogged.current && !loading && canView && actor.id) {
      viewedLogged.current = true;
      void logTrainingDashboardViewed(actor);
    }
  }, [loading, canView, actor]);

  const handleRefresh = useCallback(async () => {
    try {
      await refresh();
      toast.success('Dashboard refreshed');
    } catch {
      toast.error('Failed to refresh dashboard');
    }
  }, [refresh]);

  const handleExportPdf = useCallback(async () => {
    if (!canExport || !data) return toast.error('No export permission');
    openTrainingDashboardPdfPlaceholder(data, actor.name);
    await logTrainingDashboardExport('PDF', actor);
    toast.success('PDF report opened');
  }, [canExport, data, actor]);

  const handleExportExcel = useCallback(async () => {
    if (!canExport || !data) return toast.error('No export permission');
    exportTrainingDashboardCsv(data);
    await logTrainingDashboardExport('Excel', actor);
    toast.info('Excel export placeholder — CSV downloaded');
  }, [canExport, data, actor]);

  const recentColumns = useMemo<ColumnDef<RecentAssignmentRow>[]>(() => [
    { key: 'training_number', header: 'Training No', render: (r) => <span className="font-mono text-xs text-blue-600">{r.training_number}</span> },
    { key: 'employee_name', header: 'Employee' },
    { key: 'department', header: 'Department' },
    { key: 'training_type', header: 'Training Type' },
    { key: 'document_sop', header: 'Document / SOP', render: (r) => <span className="font-mono text-xs">{r.document_sop}</span> },
    { key: 'due_date', header: 'Due Date' },
    { key: 'status', header: 'Status', render: (r) => <TmsStatusBadge status={r.status} /> },
  ], []);

  const overdueColumns = useMemo<ColumnDef<OverdueTrainingRow>[]>(() => [
    { key: 'training_number', header: 'Training No', render: (r) => <span className="font-mono text-xs text-red-600">{r.training_number}</span> },
    { key: 'employee_name', header: 'Employee' },
    { key: 'department', header: 'Department' },
    { key: 'due_date', header: 'Due Date' },
    { key: 'days_overdue', header: 'Days Overdue', render: (r) => <span className="font-semibold text-red-600">{r.days_overdue}</span> },
    { key: 'responsible_manager', header: 'Responsible Manager' },
    { key: 'status', header: 'Status', render: (r) => <TmsStatusBadge status={r.status} /> },
  ], []);

  const effectivenessColumns = useMemo<ColumnDef<EffectivenessPendingRow>[]>(() => [
    { key: 'training_number', header: 'Training No', render: (r) => <span className="font-mono text-xs">{r.training_number}</span> },
    { key: 'employee_name', header: 'Employee' },
    { key: 'training_topic', header: 'Training Topic' },
    { key: 'effectiveness_due_date', header: 'Effectiveness Due Date' },
    { key: 'evaluator', header: 'Evaluator' },
    { key: 'status', header: 'Status', render: (r) => <TmsStatusBadge status={r.status} /> },
  ], []);

  if (!canView) {
    return (
      <ErrorCard title="Access Denied" message="You do not have permission to view the Training Management Dashboard." />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      <TmsPageHeader
        title="Training Management Dashboard"
        description="Monitor GMP training compliance, overdue training and effectiveness"
        trail={[{ label: 'Dashboard' }]}
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={() => void handleRefresh()} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            {canExport && (
              <>
                <Button variant="outline" className="gap-2" onClick={() => void handleExportPdf()}>
                  <FileText className="h-4 w-4" /> Export PDF
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => void handleExportExcel()}>
                  <FileSpreadsheet className="h-4 w-4" /> Export Excel
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => void handleExportExcel()}>
                  <Download className="h-4 w-4" /> CSV
                </Button>
              </>
            )}
            {canManage && !isReadOnly && (
              <Link href="/qms/training/assignments">
                <Button className="bg-blue-600 hover:bg-blue-700">Assign Training</Button>
              </Link>
            )}
          </div>
        )}
      />

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="text-xs">Real-time Firestore</Badge>
        <Badge variant="outline" className="text-xs">GMP Compliant</Badge>
        <Badge variant="outline" className="text-xs">Audit Ready</Badge>
      </div>

      {isReadOnly && (
        <Alert>
          <AlertTitle>Read-only access</AlertTitle>
          <AlertDescription>Auditor view — dashboard data cannot be modified.</AlertDescription>
        </Alert>
      )}
      {isDepartmentView && (
        <Alert>
          <AlertDescription>Department view — showing training data for your department.</AlertDescription>
        </Alert>
      )}
      {isEmployeeView && (
        <Alert>
          <AlertDescription>Personal view — showing your assigned training records only.</AlertDescription>
        </Alert>
      )}

      <TrainingDashboardFiltersBar
        filters={filters}
        onChange={setFilters}
        employees={employees}
        trainers={trainers}
        designations={designations}
        showDepartmentFilter={showDepartmentFilter}
        showEmployeeFilter={showEmployeeFilter}
      />

      {data?.error && (
        <Alert variant="destructive">
          <AlertTitle>Notice</AlertTitle>
          <AlertDescription>{data.error}</AlertDescription>
        </Alert>
      )}
      {error && <ErrorCard title="Load failed" message={error} onRetry={() => void handleRefresh()} />}

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : !data ? (
        <EmptyState title="No data" message="Training dashboard data is unavailable." />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {KPI_ITEMS.map((item) => (
              <KpiCard
                key={item.key}
                label={item.label}
                value={`${data.kpis[item.key] ?? 0}${item.suffix || ''}`}
                tone={item.tone}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ComplianceGauge percent={data.kpis.trainingCompliancePercent} label="Training Compliance" />
            <ComplianceGauge percent={data.kpis.departmentCompliancePercent} label="Department Compliance" />
          </div>

          <Tabs defaultValue="charts">
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="charts">Analytics Charts</TabsTrigger>
              <TabsTrigger value="assignments">Recent Assignments ({data.recentAssignments.length})</TabsTrigger>
              <TabsTrigger value="overdue">Overdue ({data.overdueTrainings.length})</TabsTrigger>
              <TabsTrigger value="effectiveness">Effectiveness Pending ({data.effectivenessPending.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="charts" className="mt-4">
              <TrainingDashboardCharts charts={data.charts} />
            </TabsContent>

            <TabsContent value="assignments" className="mt-4">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader><CardTitle className="text-base">Recent Training Assignments</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveDataTable
                    columns={recentColumns}
                    data={data.recentAssignments}
                    pageSize={10}
                    emptyMessage="No recent assignments"
                    mobileTitleKey="training_number"
                    mobileSubtitleKey="employee_name"
                    actions={(r) => viewAction(r.id)}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="overdue" className="mt-4">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader><CardTitle className="text-base">Overdue Trainings</CardTitle></CardHeader>
                <CardContent>
                  {data.overdueTrainings.length === 0 ? (
                    <EmptyState title="No overdue trainings" message="All assignments are within due dates." />
                  ) : (
                    <ResponsiveDataTable
                      columns={overdueColumns}
                      data={data.overdueTrainings}
                      pageSize={10}
                      emptyMessage="No overdue trainings"
                      mobileTitleKey="training_number"
                      mobileSubtitleKey="employee_name"
                      actions={(r) => viewAction(r.id)}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="effectiveness" className="mt-4">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader><CardTitle className="text-base">Effectiveness Pending</CardTitle></CardHeader>
                <CardContent>
                  {data.effectivenessPending.length === 0 ? (
                    <EmptyState title="No pending effectiveness" message="All completed trainings have been evaluated." />
                  ) : (
                    <ResponsiveDataTable
                      columns={effectivenessColumns}
                      data={data.effectivenessPending}
                      pageSize={10}
                      emptyMessage="No pending effectiveness evaluations"
                      mobileTitleKey="training_number"
                      mobileSubtitleKey="employee_name"
                      actions={(r) => effectivenessAction(r.id)}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
            <CardContent><TrainingActivityTimeline entries={data.activity} /></CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
