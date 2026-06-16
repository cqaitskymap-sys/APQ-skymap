'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle, CheckCircle2, Clock, FileSpreadsheet, FileText, Flame,
  Link2, Plus, RefreshCw, Repeat, ShieldAlert, Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import { exportDeviationsCsv } from '@/lib/deviation-service';
import type { DeviationFilters, DeviationKpiFilter, DeviationRecord } from '@/lib/deviation-types';
import {
  canExportDeviationDashboard,
  fetchDeviationDashboardData,
  getCriticalDeviations,
  getDaysOverdue,
  getOverdueDeviations,
  getRecentDeviations,
  logDeviationDashboardAudit,
  type DeviationDashboardData,
} from '@/services/deviationDashboardService';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { KpiCard } from '@/components/admin/dashboard/kpi-card';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { DeviationDashboardAccessGuard } from '@/components/deviations/deviation-dashboard-access-guard';
import { DeviationDashboardCharts } from '@/components/deviations/deviation-dashboard-charts';
import { DeviationFiltersBar } from '@/components/deviations/deviation-filters';
import { DeviationActivityTimeline } from '@/components/deviations/deviation-activity-timeline';
import { DeviationCriticalityBadge, DeviationStatusBadge } from '@/components/deviations/deviation-sub-nav';
import { RiskBadge } from '@/components/deviations/deviation-risk-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const KPI_CONFIG: { key: DeviationKpiFilter; label: string; metric: keyof DeviationDashboardData['metrics']; accent: string; icon: typeof AlertTriangle }[] = [
  { key: 'all', label: 'Total Deviations', metric: 'total', accent: 'border-l-blue-600', icon: AlertTriangle },
  { key: 'open', label: 'Open Deviations', metric: 'open', accent: 'border-l-amber-500', icon: Clock },
  { key: 'closed', label: 'Closed Deviations', metric: 'closed', accent: 'border-l-green-600', icon: CheckCircle2 },
  { key: 'draft', label: 'Draft Deviations', metric: 'draft', accent: 'border-l-slate-500', icon: FileText },
  { key: 'under_investigation', label: 'Under Investigation', metric: 'underInvestigation', accent: 'border-l-yellow-500', icon: Clock },
  { key: 'qa_review', label: 'QA Review Pending', metric: 'qaReviewPending', accent: 'border-l-purple-600', icon: ShieldAlert },
  { key: 'capa_required', label: 'CAPA Required', metric: 'capaRequired', accent: 'border-l-orange-500', icon: Link2 },
  { key: 'capa_linked', label: 'CAPA Linked', metric: 'capaLinked', accent: 'border-l-orange-600', icon: Link2 },
  { key: 'overdue', label: 'Overdue Deviations', metric: 'overdue', accent: 'border-l-red-600', icon: Flame },
  { key: 'critical', label: 'Critical Deviations', metric: 'critical', accent: 'border-l-red-700', icon: AlertTriangle },
  { key: 'major', label: 'Major Deviations', metric: 'major', accent: 'border-l-orange-600', icon: AlertTriangle },
  { key: 'minor', label: 'Minor Deviations', metric: 'minor', accent: 'border-l-blue-500', icon: AlertTriangle },
  { key: 'repeat', label: 'Repeat Deviations', metric: 'repeat', accent: 'border-l-purple-500', icon: Repeat },
  { key: 'batch_impacted', label: 'Batch Impacted', metric: 'batchImpacted', accent: 'border-l-red-500', icon: Flame },
  { key: 'product_quality', label: 'Product Quality Impact', metric: 'productQualityImpact', accent: 'border-l-amber-600', icon: AlertTriangle },
  { key: 'patient_safety', label: 'Patient Safety Impact', metric: 'patientSafetyImpact', accent: 'border-l-red-800', icon: ShieldAlert },
];

function ViewAction({ id }: { id: string }) {
  return (
    <Link href={`/qms/deviation/${id}`}>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
    </Link>
  );
}

function DeviationDashboardInner() {
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();
  const actor = {
    id: user?.uid || 'anonymous',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role,
  };

  const initialFilters = useMemo<DeviationFilters>(() => ({
    status: searchParams.get('status') || undefined,
    capa_required: searchParams.get('capa_required') === 'true' ? true : undefined,
  }), [searchParams]);

  const [filters, setFilters] = useState<DeviationFilters>(initialFilters);
  const [kpiFilter, setKpiFilter] = useState<DeviationKpiFilter>('all');
  const [data, setData] = useState<DeviationDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewLogged, setViewLogged] = useState(false);

  const mergedFilters = useMemo(
    () => ({ ...filters, kpi_filter: kpiFilter }),
    [filters, kpiFilter],
  );

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const result = await fetchDeviationDashboardData(mergedFilters, profile?.role);
    setData(result);
    setLoading(false);
    setRefreshing(false);

    if (result.error) toast.error(result.error);
    else if (isRefresh) toast.success('Dashboard refreshed');
    return result;
  }, [mergedFilters, profile?.role]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!viewLogged && user?.uid) {
      setViewLogged(true);
      void logDeviationDashboardAudit('Dashboard Viewed', {
        id: user.uid,
        name: profile?.full_name || profile?.email || 'User',
        role: profile?.role,
      });
    }
  }, [viewLogged, user?.uid, profile?.full_name, profile?.email, profile?.role]);

  const handleFiltersChange = (next: DeviationFilters) => {
    setFilters(next);
    void logDeviationDashboardAudit('Filter Applied', actor, JSON.stringify(next));
  };

  const handleRefresh = async () => {
    await load(true);
    await logDeviationDashboardAudit('Dashboard Refreshed', actor);
  };

  const handleExportExcel = () => {
    if (!canExportDeviationDashboard(profile?.role)) {
      toast.error('You do not have permission to export');
      return;
    }
    exportDeviationsCsv(data?.records || []);
    void logDeviationDashboardAudit('Excel Export Clicked', actor);
    toast.success('Excel export started');
  };

  const handleExportPdf = () => {
    if (!canExportDeviationDashboard(profile?.role)) {
      toast.error('You do not have permission to export');
      return;
    }
    void logDeviationDashboardAudit('PDF Export Clicked', actor);
    toast.info('PDF export will be available in a future release');
  };

  const handleKpiClick = (key: DeviationKpiFilter) => {
    setKpiFilter((prev) => (prev === key && key !== 'all' ? 'all' : key));
  };

  const records = useMemo(() => data?.records || [], [data?.records]);
  const metrics = data?.metrics;
  const recent = useMemo(() => getRecentDeviations(records), [records]);
  const overdue = useMemo(() => getOverdueDeviations(records), [records]);
  const critical = useMemo(() => getCriticalDeviations(records).slice(0, 10), [records]);

  const recentColumns = useMemo(() => [
    { key: 'deviation_number', header: 'Deviation No', render: (r: DeviationRecord) => <span className="font-mono text-sm text-blue-600">{r.deviation_number}</span> },
    { key: 'deviation_date', header: 'Date' },
    { key: 'department', header: 'Department' },
    { key: 'product_name', header: 'Product' },
    { key: 'batch_number', header: 'Batch No', render: (r: DeviationRecord) => r.batch_number || '—' },
    { key: 'category', header: 'Category' },
    { key: 'criticality', header: 'Criticality', render: (r: DeviationRecord) => <DeviationCriticalityBadge criticality={r.criticality} /> },
    { key: 'status', header: 'Status', render: (r: DeviationRecord) => <DeviationStatusBadge status={r.status} /> },
    { key: 'assigned_investigator_name', header: 'Assigned To', render: (r: DeviationRecord) => r.assigned_investigator_name || '—' },
    { key: 'target_closure_date', header: 'Due Date', render: (r: DeviationRecord) => r.target_closure_date || '—' },
    { key: 'actions', header: 'Action', render: (r: DeviationRecord) => <ViewAction id={r.id} /> },
  ], []);

  const overdueColumns = useMemo(() => [
    { key: 'deviation_number', header: 'Deviation No', render: (r: DeviationRecord) => <span className="font-mono text-sm text-blue-600">{r.deviation_number}</span> },
    { key: 'department', header: 'Department' },
    { key: 'criticality', header: 'Criticality', render: (r: DeviationRecord) => <DeviationCriticalityBadge criticality={r.criticality} /> },
    { key: 'target_closure_date', header: 'Target Closure' },
    { key: 'days_overdue', header: 'Days Overdue', render: (r: DeviationRecord) => <span className="font-semibold text-red-600">{getDaysOverdue(r)}</span> },
    { key: 'assigned_investigator_name', header: 'Assigned To', render: (r: DeviationRecord) => r.assigned_investigator_name || '—' },
    { key: 'status', header: 'Status', render: (r: DeviationRecord) => <DeviationStatusBadge status={r.status} /> },
    { key: 'actions', header: 'Action', render: (r: DeviationRecord) => <ViewAction id={r.id} /> },
  ], []);

  const criticalColumns = useMemo(() => [
    { key: 'deviation_number', header: 'Deviation No', render: (r: DeviationRecord) => <span className="font-mono text-sm text-blue-600">{r.deviation_number}</span> },
    { key: 'product_name', header: 'Product' },
    { key: 'batch_number', header: 'Batch No', render: (r: DeviationRecord) => r.batch_number || '—' },
    { key: 'impact', header: 'Impact', render: (r: DeviationRecord) => (
      <span className="text-xs">
        {[r.batch_impacted && 'Batch', r.product_quality_impacted && 'Quality', r.patient_safety_impacted && 'Patient Safety'].filter(Boolean).join(', ') || '—'}
      </span>
    ) },
    { key: 'risk_assessment', header: 'Risk', render: (r: DeviationRecord) => <RiskBadge risk={r.risk_assessment} /> },
    { key: 'capa_required', header: 'CAPA Required', render: (r: DeviationRecord) => r.capa_required ? 'Yes' : 'No' },
    { key: 'status', header: 'Status', render: (r: DeviationRecord) => <DeviationStatusBadge status={r.status} /> },
    { key: 'actions', header: 'Action', render: (r: DeviationRecord) => <ViewAction id={r.id} /> },
  ], []);

  if (loading) return <LoadingSkeleton rows={4} />;

  return (
    <div className="space-y-6 animate-in fade-in">
      <CpvPageHeader
        title="Deviation Dashboard"
        description="Monitor, investigate and track GMP deviations across departments"
        trail={[
          { label: 'QMS', href: '/qms/deviation' },
          { label: 'Deviation Management', href: '/qms/deviation' },
          { label: 'Dashboard' },
        ]}
        actions={(
          <>
            <Button variant="outline" className="gap-2" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
              Refresh
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleExportPdf}>
              <FileText className="h-4 w-4" />Export PDF
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleExportExcel}>
              <FileSpreadsheet className="h-4 w-4" />Export Excel
            </Button>
            <Link href="/qms/deviation/create">
              <Button className="gap-2 bg-blue-600 hover:bg-blue-700"><Plus className="h-4 w-4" />Create Deviation</Button>
            </Link>
          </>
        )}
      />

      {data?.error && <ErrorCard title="Data load issue" message={data.error} onRetry={handleRefresh} />}

      {metrics && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-8">
          {KPI_CONFIG.map(({ key, label, metric, accent, icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => handleKpiClick(key)}
              className={cn('text-left transition-opacity', kpiFilter === key && key !== 'all' && 'ring-2 ring-blue-500 rounded-lg')}
            >
              <KpiCard label={label} value={metrics[metric] as number} icon={icon} accent={accent} />
            </button>
          ))}
        </div>
      )}

      {metrics && metrics.avgClosureDays > 0 && (
        <p className="text-sm text-muted-foreground">
          Average closure time: <span className="font-semibold text-slate-900 dark:text-slate-100">{metrics.avgClosureDays} days</span>
        </p>
      )}

      <DeviationFiltersBar filters={filters} onChange={handleFiltersChange} />

      {metrics && <DeviationDashboardCharts metrics={metrics} />}

      {(overdue.length > 0 || critical.length > 0) && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {overdue.length > 0 && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <Flame className="h-5 w-5" />Critical Alerts — Overdue ({overdue.length})
                </CardTitle>
                <CardDescription>Deviations past target closure date</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveDataTable
                  columns={overdueColumns}
                  data={overdue.slice(0, 10)}
                  mobileTitleKey="deviation_number"
                  mobileSubtitleKey="department"
                  pageSize={10}
                />
              </CardContent>
            </Card>
          )}
          {critical.length > 0 && (
            <Card className="border-orange-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-700">
                  <AlertTriangle className="h-5 w-5" />High Priority Deviations ({critical.length})
                </CardTitle>
                <CardDescription>Critical / major deviations requiring attention</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveDataTable
                  columns={criticalColumns}
                  data={critical}
                  mobileTitleKey="deviation_number"
                  mobileSubtitleKey="product_name"
                  pageSize={10}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent Deviations</CardTitle>
          <CardDescription>{records.length} record(s) matching filters</CardDescription>
        </CardHeader>
        <CardContent>
          {recent.length ? (
            <ResponsiveDataTable
              columns={recentColumns}
              data={recent}
              searchKeys={['deviation_number', 'product_name', 'department']}
              mobileTitleKey="deviation_number"
              mobileSubtitleKey="department"
              pageSize={15}
            />
          ) : (
            <EmptyState title="No deviations found" message="Adjust filters or create a new deviation record." />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest deviation workflow and audit events</CardDescription>
        </CardHeader>
        <CardContent>
          <DeviationActivityTimeline entries={data?.activity || []} />
        </CardContent>
      </Card>
    </div>
  );
}

export function DeviationDashboardPage() {
  return (
    <DeviationDashboardAccessGuard>
      <Suspense fallback={<LoadingSkeleton rows={3} />}>
        <DeviationDashboardInner />
      </Suspense>
    </DeviationDashboardAccessGuard>
  );
}
