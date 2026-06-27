'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Download, Eye, FileText, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { useTrainingManagementDashboard } from '@/hooks/use-training';
import {
  canExportTrainingDashboard,
  canViewTrainingDashboard,
  isEmployeeTrainingView,
  isTmsReadOnly,
} from '@/lib/training-types';
import type {
  RecentAssignmentRow,
  OverdueTrainingRow,
  EffectivenessPendingRow,
} from '@/lib/training-dashboard-records';
import {
  logTrainingDashboardExport,
  openTrainingDashboardPdfPlaceholder,
} from '@/lib/training-dashboard-service';

const KPI_ITEMS: {
  label: string;
  key: keyof import('@/lib/training-dashboard-records').TrainingDashboardKpis;
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
  { label: 'Not Effective Trainings', key: 'notEffectiveTrainings', tone: 'red' },
  { label: 'Training Compliance %', key: 'trainingCompliancePercent', suffix: '%', tone: 'green' },
  { label: 'Department Compliance %', key: 'departmentCompliancePercent', suffix: '%', tone: 'green' },
  { label: 'Users Not Trained', key: 'usersNotTrained', tone: 'red' },
  { label: 'Training Due This Week', key: 'trainingDueThisWeek', tone: 'amber' },
];

function viewAction(id: string) {
  return (
    <Link href={`/qms/training/assignments?highlight=${id}`}>
      <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
    </Link>
  );
}

export function TrainingManagementDashboardPage() {
  const viewedLogged = useRef(false);
  const {
    data,
    filters,
    setFilters,
    employees,
    loading,
    refreshing,
    error,
    refresh,
    role,
    actor,
    showDepartmentFilter,
    showEmployeeFilter,
  } = useTrainingManagementDashboard();

  const canView = role ? canViewTrainingDashboard(role) : false;
  const canExport = role ? canExportTrainingDashboard(role) : false;
  const readOnly = role ? isTmsReadOnly(role) : false;

  useEffect(() => {
    if (!viewedLogged.current && !loading && canView && actor.id) {
      viewedLogged.current = true;
      void import('@/lib/training-dashboard-service').then((m) => m.logTrainingDashboardViewed(actor));
    }
  }, [loading, canView, actor]);

  const handleRefresh = useCallback(async () => {
    try {
      await refresh();
      toast.success('Training dashboard refreshed');
    } catch {
      toast.error('Failed to refresh dashboard');
    }
  }, [refresh]);

  const handleExportPdf = useCallback(async () => {
    if (!canExport || !data) return toast.error('No export permission');
    openTrainingDashboardPdfPlaceholder(data, actor.name);
    await logTrainingDashboardExport('PDF', actor);
    toast.success('PDF export placeholder opened (audit logged)');
  }, [canExport, data, actor]);

  const handleExportExcel = useCallback(async () => {
    if (!canExport || !data) return toast.error('No export permission');
    await logTrainingDashboardExport('Excel', actor);
    toast.success('Excel export placeholder — audit logged');
  }, [canExport, data, actor]);

  const recentColumns = useMemo<ColumnDef<RecentAssignmentRow>[]>(() => [
    { key: 'training_number', header: 'Training No', render: (r) => <span className="font-mono text-blue-600">{r.training_number}</span> },
    { key: 'employee_name', header: 'Employee' },
    { key: 'department', header: 'Department' },
    { key: 'training_type', header: 'Training Type' },
    { key: 'document_sop', header: 'Document / SOP' },
    { key: 'due_date', header: 'Due Date' },
    { key: 'status', header: 'Status', render: (r) => <TmsStatusBadge status={r.status} /> },
  ], []);

  const overdueColumns = useMemo<ColumnDef<OverdueTrainingRow>[]>(() => [
    { key: 'training_number', header: 'Training No', render: (r) => <span className="font-mono text-red-600">{r.training_number}</span> },
    { key: 'employee_name', header: 'Employee' },
    { key: 'department', header: 'Department' },
    { key: 'due_date', header: 'Due Date' },
    { key: 'days_overdue', header: 'Days Overdue', render: (r) => <span className="font-semibold text-red-600">{r.days_overdue}</span> },
    { key: 'responsible_manager', header: 'Responsible Manager' },
    { key: 'status', header: 'Status', render: (r) => <TmsStatusBadge status={r.status} /> },
  ], []);

  const effColumns = useMemo<ColumnDef<EffectivenessPendingRow>[]>(() => [
    { key: 'training_number', header: 'Training No', render: (r) => <span className="font-mono text-amber-600">{r.training_number}</span> },
    { key: 'employee_name', header: 'Employee' },
    { key: 'training_topic', header: 'Training Topic' },
    { key: 'effectiveness_due_date', header: 'Effectiveness Due Date' },
    { key: 'evaluator', header: 'Evaluator' },
    { key: 'status', header: 'Status', render: (r) => <TmsStatusBadge status={r.status} /> },
  ], []);

  if (!canView) {
    return (
      <ErrorCard
        title="Access Denied"
        message="You do not have permission to view the Training Management Dashboard."
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      <TmsPageHeader
        title="Training Management Dashboard"
        description="Monitor GMP training compliance, overdue training and effectiveness"
        trail={[{ label: 'Dashboard' }]}
        actions={(
          <>
            <Button variant="outline" className="gap-2" onClick={() => void handleRefresh()} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {canExport && (
              <>
                <Button variant="outline" className="gap-2" onClick={() => void handleExportPdf()}>
                  <FileText className="h-4 w-4" />Export PDF
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => void handleExportExcel()}>
                  <Download className="h-4 w-4" />Export Excel
                </Button>
              </>
            )}
            {!readOnly && !isEmployeeTrainingView(role || '') && (
              <Link href="/qms/training/assignments">
                <Button className="bg-blue-600 hover:bg-blue-700">Assign Training</Button>
              </Link>
            )}
          </>
        )}
      />

      {readOnly && (
        <Alert>
          <AlertTitle>Read-only access</AlertTitle>
          <AlertDescription>Auditor view — export and assignment actions are disabled.</AlertDescription>
        </Alert>
      )}

      <TrainingDashboardFiltersBar
        filters={filters}
        onChange={setFilters}
        employees={employees}
        showDepartmentFilter={showDepartmentFilter}
        showEmployeeFilter={showEmployeeFilter}
      />

      {data?.error && (
        <Alert variant="destructive">
          <AlertTitle>Configuration notice</AlertTitle>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {KPI_ITEMS.map((item) => (
              <KpiCard
                key={item.key}
                label={item.label}
                value={`${data.kpis[item.key]}${item.suffix || ''}`}
                tone={item.tone}
              />
            ))}
          </div>

          <TrainingDashboardCharts charts={data.charts} />

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Card className="xl:col-span-2 border-slate-200 shadow-sm">
              <CardHeader><CardTitle>Recent Training Assignments</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveDataTable
                  columns={recentColumns}
                  data={data.recentAssignments}
                  pageSize={10}
                  emptyMessage="No recent training assignments"
                  mobileTitleKey="training_number"
                  mobileSubtitleKey="employee_name"
                  statusKey="status"
                  actions={(r) => viewAction(r.id)}
                />
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
              <CardContent>
                <TrainingActivityTimeline entries={data.activity} />
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader><CardTitle>Overdue Trainings</CardTitle></CardHeader>
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
                  statusKey="status"
                  actions={(r) => viewAction(r.id)}
                />
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader><CardTitle>Effectiveness Pending</CardTitle></CardHeader>
            <CardContent>
              {data.effectivenessPending.length === 0 ? (
                <EmptyState title="No pending effectiveness" message="All completed trainings have been evaluated." />
              ) : (
                <ResponsiveDataTable
                  columns={effColumns}
                  data={data.effectivenessPending}
                  pageSize={10}
                  emptyMessage="No effectiveness pending"
                  mobileTitleKey="training_number"
                  mobileSubtitleKey="employee_name"
                  statusKey="status"
                  actions={(r) => (
                    <Link href={`/qms/training/effectiveness?assignment=${r.id}`}>
                      <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                    </Link>
                  )}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
