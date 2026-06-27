'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, CheckCircle2, Clock, FileSpreadsheet, FileText, RefreshCw,
  Shield, ShieldAlert, TrendingUp, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import {
  RISK_DASHBOARD_CATEGORIES,
  canCreateFromDashboard,
  canExportRiskDashboard,
  isRiskDashboardReadOnly,
  type RiskDashboardData,
  type RiskDashboardFilters,
  type RiskDashboardKpiFilter,
  type RiskDashboardTableRow,
} from '@/lib/risk-dashboard-records';
import {
  fetchRiskDashboardData,
  logDashboardExport,
  logDashboardFilterApplied,
  logDashboardRefreshed,
  logDashboardViewed,
  logRiskOpened,
} from '@/lib/risk-dashboard-service';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { KpiCard } from '@/components/admin/dashboard/kpi-card';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { RiskMatrix } from '@/components/cpv/risk-assessment/risk-matrix';
import { RiskHeatMap } from '@/components/cpv/risk-assessment/risk-heatmap';
import { RiskDashboardAccessGuard } from './risk-dashboard-access-guard';
import { RiskBadge, StatusBadge } from './risk-dashboard-badges';
import { RiskDashboardCharts } from './risk-dashboard-charts';
import { RiskDashboardActivityTimeline } from './risk-dashboard-activity';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const defaultFrom = () => `${new Date().getFullYear()}-01-01`;
const defaultTo = () => new Date().toISOString().split('T')[0];

const KPI_ITEMS: { key: RiskDashboardKpiFilter; label: string; metricKey: keyof RiskDashboardData['metrics']; accent: string; icon?: typeof Shield }[] = [
  { key: 'all', label: 'Total Risks', metricKey: 'totalRisks', accent: 'border-l-blue-600', icon: Shield },
  { key: 'open', label: 'Open Risks', metricKey: 'openRisks', accent: 'border-l-sky-600' },
  { key: 'closed', label: 'Closed Risks', metricKey: 'closedRisks', accent: 'border-l-green-600', icon: CheckCircle2 },
  { key: 'critical', label: 'Critical Risks', metricKey: 'criticalRisks', accent: 'border-l-red-600', icon: ShieldAlert },
  { key: 'high', label: 'High Risks', metricKey: 'highRisks', accent: 'border-l-orange-600' },
  { key: 'medium', label: 'Medium Risks', metricKey: 'mediumRisks', accent: 'border-l-amber-500' },
  { key: 'low', label: 'Low Risks', metricKey: 'lowRisks', accent: 'border-l-green-500' },
  { key: 'pending_mitigation', label: 'Pending Mitigation', metricKey: 'pendingMitigation', accent: 'border-l-amber-600' },
  { key: 'mitigation_in_progress', label: 'Mitigation In Progress', metricKey: 'mitigationInProgress', accent: 'border-l-blue-500' },
  { key: 'overdue', label: 'Overdue Risks', metricKey: 'overdueRisks', accent: 'border-l-red-500', icon: Clock },
  { key: 'residual_high', label: 'Residual High Risks', metricKey: 'residualHighRisks', accent: 'border-l-purple-600' },
  { key: 'approved', label: 'Approved Risks', metricKey: 'approvedRisks', accent: 'border-l-emerald-600' },
  { key: 'rejected', label: 'Rejected Risks', metricKey: 'rejectedRisks', accent: 'border-l-red-700', icon: XCircle },
  { key: 'under_review', label: 'Risks Under Review', metricKey: 'risksUnderReview', accent: 'border-l-indigo-600', icon: TrendingUp },
];

function ActionLink({ row, onOpen }: { row: RiskDashboardTableRow; onOpen: (id: string, num: string) => void }) {
  return (
    <Link href={`/cpv/risk-assessment/${row.id}`} onClick={() => onOpen(row.id, row.risk_number)}>
      <Button variant="ghost" size="sm" className="h-8 text-blue-600">View</Button>
    </Link>
  );
}

export function RiskDashboardPage() {
  const { user, profile } = useAuth();
  const readOnly = isRiskDashboardReadOnly(profile?.role);
  const canExport = canExportRiskDashboard(profile?.role) && !readOnly;
  const canCreate = canCreateFromDashboard(profile?.role);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RiskDashboardData | null>(null);
  const [filters, setFilters] = useState<RiskDashboardFilters>({
    department: 'All',
    product: 'All',
    risk_category: 'All',
    risk_level: 'All',
    date_from: defaultFrom(),
    date_to: defaultTo(),
    kpi_filter: 'all',
  });

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'User',
    role: profile?.role || '',
    department: profile?.department || '',
  }), [user?.uid, profile?.full_name, profile?.email, profile?.role, profile?.department]);

  const load = useCallback(async (nextFilters = filters, auditRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchRiskDashboardData(nextFilters, actor);
      setData(result);
      if (auditRefresh) {
        await logDashboardRefreshed(actor);
        toast.success('Dashboard refreshed');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [actor, filters]);

  useEffect(() => {
    void logDashboardViewed(actor);
    void load(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = (patch: Partial<RiskDashboardFilters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    void logDashboardFilterApplied(actor, next);
    void load(next);
  };

  const handleKpiClick = (key: RiskDashboardKpiFilter) => {
    handleFilterChange({ kpi_filter: filters.kpi_filter === key && key !== 'all' ? 'all' : key });
  };

  const handleOpenRisk = useCallback((id: string, riskNumber: string) => {
    void logRiskOpened(actor, id, riskNumber);
  }, [actor]);

  const handleExport = async (type: 'PDF' | 'Excel') => {
    await logDashboardExport(actor, type);
    toast.info(`${type} export placeholder — audit trail recorded`);
  };

  const recentCols = useMemo(() => [
    { key: 'risk_number', header: 'Risk No', render: (r: RiskDashboardTableRow) => <span className="font-mono text-blue-600">{r.risk_number}</span> },
    { key: 'risk_title', header: 'Risk Title', render: (r: RiskDashboardTableRow) => <span className="line-clamp-1 max-w-xs">{r.risk_title}</span> },
    { key: 'risk_category', header: 'Category', render: (r: RiskDashboardTableRow) => r.risk_category },
    { key: 'department', header: 'Department', render: (r: RiskDashboardTableRow) => r.department },
    { key: 'risk_level', header: 'Risk Level', render: (r: RiskDashboardTableRow) => <RiskBadge level={r.risk_level} /> },
    { key: 'rpn', header: 'RPN', render: (r: RiskDashboardTableRow) => r.rpn },
    { key: 'risk_owner', header: 'Owner', render: (r: RiskDashboardTableRow) => r.risk_owner },
    { key: 'status', header: 'Status', render: (r: RiskDashboardTableRow) => <StatusBadge status={r.status} /> },
    { key: 'actions', header: 'Action', render: (r: RiskDashboardTableRow) => <ActionLink row={r} onOpen={handleOpenRisk} /> },
  ], [handleOpenRisk]);

  const criticalCols = useMemo(() => [
    { key: 'risk_number', header: 'Risk No', render: (r: RiskDashboardTableRow) => <span className="font-mono">{r.risk_number}</span> },
    { key: 'risk_title', header: 'Risk Title', render: (r: RiskDashboardTableRow) => r.risk_title },
    { key: 'risk_category', header: 'Category', render: (r: RiskDashboardTableRow) => r.risk_category },
    { key: 'rpn', header: 'RPN', render: (r: RiskDashboardTableRow) => <span className="font-semibold text-red-700">{r.rpn}</span> },
    { key: 'risk_owner', header: 'Owner', render: (r: RiskDashboardTableRow) => r.risk_owner },
    { key: 'mitigation_status', header: 'Mitigation Status', render: (r: RiskDashboardTableRow) => r.mitigation_status },
    { key: 'target_date', header: 'Due Date', render: (r: RiskDashboardTableRow) => r.target_date },
    { key: 'actions', header: 'Action', render: (r: RiskDashboardTableRow) => <ActionLink row={r} onOpen={handleOpenRisk} /> },
  ], [handleOpenRisk]);

  const overdueCols = useMemo(() => [
    { key: 'risk_number', header: 'Risk No', render: (r: RiskDashboardTableRow) => r.risk_number },
    { key: 'risk_owner', header: 'Owner', render: (r: RiskDashboardTableRow) => r.risk_owner },
    { key: 'department', header: 'Department', render: (r: RiskDashboardTableRow) => r.department },
    { key: 'target_date', header: 'Due Date', render: (r: RiskDashboardTableRow) => r.target_date },
    { key: 'days_overdue', header: 'Days Overdue', render: (r: RiskDashboardTableRow) => <span className="text-red-600 font-medium">{r.days_overdue}</span> },
    { key: 'status', header: 'Status', render: (r: RiskDashboardTableRow) => <StatusBadge status={r.status} /> },
    { key: 'actions', header: 'Action', render: (r: RiskDashboardTableRow) => <ActionLink row={r} onOpen={handleOpenRisk} /> },
  ], [handleOpenRisk]);

  const residualCols = useMemo(() => [
    { key: 'risk_number', header: 'Risk No', render: (r: RiskDashboardTableRow) => r.risk_number },
    { key: 'initial_rpn', header: 'Initial RPN', render: (r: RiskDashboardTableRow) => r.initial_rpn },
    { key: 'residual_rpn', header: 'Residual RPN', render: (r: RiskDashboardTableRow) => <span className="text-orange-700 font-medium">{r.residual_rpn}</span> },
    { key: 'risk_owner', header: 'Owner', render: (r: RiskDashboardTableRow) => r.risk_owner },
    { key: 'status', header: 'Status', render: (r: RiskDashboardTableRow) => <StatusBadge status={r.status} /> },
    { key: 'actions', header: 'Action', render: (r: RiskDashboardTableRow) => <ActionLink row={r} onOpen={handleOpenRisk} /> },
  ], [handleOpenRisk]);

  return (
    <RiskDashboardAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Risk Assessment Dashboard"
          description="Monitor GMP quality risks, mitigation activities and residual risk status"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/risk-management' },
            { label: 'Risk Management', href: '/qms/risk-management' },
            { label: 'Dashboard' },
          ]}
          actions={(
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => void load(filters, true)} disabled={loading}>
                <RefreshCw className={cn('mr-1 h-4 w-4', loading && 'animate-spin')} />Refresh
              </Button>
              {canExport ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => void handleExport('PDF')}>
                    <FileText className="mr-1 h-4 w-4" />PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void handleExport('Excel')}>
                    <FileSpreadsheet className="mr-1 h-4 w-4" />Excel
                  </Button>
                </>
              ) : null}
              {!readOnly && canCreate ? (
                <Link href="/qms/risk-management/create">
                  <Button size="sm">Create Risk</Button>
                </Link>
              ) : null}
            </div>
          )}
        />

        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <div>
              <Label className="text-xs">Department</Label>
              <Select value={filters.department} onValueChange={(v) => handleFilterChange({ department: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(data?.departments || ['All']).map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Product</Label>
              <Select value={filters.product} onValueChange={(v) => handleFilterChange({ product: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(data?.products || ['All']).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Risk Category</Label>
              <Select value={filters.risk_category} onValueChange={(v) => handleFilterChange({ risk_category: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  {RISK_DASHBOARD_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Risk Level</Label>
              <Select value={filters.risk_level} onValueChange={(v) => handleFilterChange({ risk_level: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['All', 'Low', 'Medium', 'High', 'Critical'].map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Date From</Label>
              <Input type="date" className="h-9" value={filters.date_from} onChange={(e) => handleFilterChange({ date_from: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Date To</Label>
              <Input type="date" className="h-9" value={filters.date_to} onChange={(e) => handleFilterChange({ date_to: e.target.value })} />
            </div>
          </CardContent>
        </Card>

        {loading && !data ? <LoadingSkeleton rows={4} /> : error ? (
          <ErrorCard title="Unable to load dashboard" message={error} onRetry={() => void load(filters, true)} />
        ) : data ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                Showing <strong>{data.filteredCount}</strong> of <strong>{data.metrics.totalRisks}</strong> risks
                {filters.kpi_filter !== 'all' ? ` · KPI filter: ${filters.kpi_filter.replace(/_/g, ' ')}` : ''}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-3">
              {KPI_ITEMS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleKpiClick(item.key)}
                  className={cn('text-left transition-opacity', filters.kpi_filter === item.key && 'ring-2 ring-blue-500 rounded-lg')}
                >
                  <KpiCard
                    label={item.label}
                    value={data.metrics[item.metricKey]}
                    icon={item.icon}
                    accent={item.accent}
                  />
                </button>
              ))}
            </div>

            {data.filteredCount === 0 && data.metrics.totalRisks === 0 ? (
              <EmptyState
                title="No risk assessments"
                message="Create a risk assessment to populate the dashboard."
              />
            ) : (
              <>
                <RiskDashboardCharts charts={data.charts} />

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader><CardTitle className="text-base">Risk Heat Map</CardTitle></CardHeader>
                    <CardContent><RiskHeatMap heatMap={data.widgets.heatMap} /></CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-base">Risk Matrix</CardTitle></CardHeader>
                    <CardContent><RiskMatrix matrix={data.widgets.matrix} /></CardContent>
                  </Card>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <Card>
                    <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-600" />Top 10 Critical Risks</CardTitle></CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {data.widgets.top10Critical.length ? data.widgets.top10Critical.map((r) => (
                        <div key={r.id} className="flex justify-between gap-2 border-b pb-2">
                          <div>
                            <p className="font-mono text-xs text-blue-600">{r.risk_number}</p>
                            <p className="line-clamp-1">{r.risk_title}</p>
                          </div>
                          <RiskBadge level={r.risk_level} />
                        </div>
                      )) : <p className="text-muted-foreground text-sm">No critical risks</p>}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-base">Department Risk Ranking</CardTitle></CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {data.widgets.departmentRanking.map((d) => (
                        <div key={d.name} className="flex justify-between">
                          <span>{d.name}</span>
                          <span className="tabular-nums">{d.count} <span className="text-red-600">({d.critical} crit.)</span></span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
                    <CardContent className="max-h-[320px] overflow-y-auto">
                      <RiskDashboardActivityTimeline entries={data.activity} />
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader><CardTitle className="text-base">Pending Mitigation Tasks</CardTitle></CardHeader>
                    <CardContent>
                      {data.widgets.pendingMitigationTasks.length ? (
                        <table className="w-full text-sm">
                          <thead><tr className="text-left text-xs text-muted-foreground"><th className="pb-2">Risk</th><th>Owner</th><th>Due</th></tr></thead>
                          <tbody>
                            {data.widgets.pendingMitigationTasks.map((t) => (
                              <tr key={t.risk_number} className="border-t">
                                <td className="py-2"><span className="font-mono text-xs">{t.risk_number}</span><br /><span className="line-clamp-1">{t.title}</span></td>
                                <td>{t.owner}</td>
                                <td>{t.due_date}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : <p className="text-sm text-muted-foreground">No pending mitigation tasks</p>}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-base">Upcoming Risk Reviews</CardTitle></CardHeader>
                    <CardContent>
                      {data.widgets.upcomingReviews.length ? (
                        <table className="w-full text-sm">
                          <thead><tr className="text-left text-xs text-muted-foreground"><th className="pb-2">Risk</th><th>Review Date</th><th>Reviewer</th></tr></thead>
                          <tbody>
                            {data.widgets.upcomingReviews.map((r) => (
                              <tr key={`${r.risk_number}-${r.review_date}`} className="border-t">
                                <td className="py-2 font-mono text-xs">{r.risk_number}</td>
                                <td>{r.review_date}</td>
                                <td>{r.reviewer}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : <p className="text-sm text-muted-foreground">No upcoming reviews scheduled</p>}
                    </CardContent>
                  </Card>
                </div>

                <Tabs defaultValue="recent">
                  <TabsList className="flex flex-wrap h-auto gap-1">
                    <TabsTrigger value="recent">Recent Risks</TabsTrigger>
                    <TabsTrigger value="critical">Critical Risks</TabsTrigger>
                    <TabsTrigger value="overdue">Overdue Risks</TabsTrigger>
                    <TabsTrigger value="residual">Residual High Risks</TabsTrigger>
                  </TabsList>
                  <TabsContent value="recent" className="mt-4">
                    {data.recentRisks.length ? (
                      <ResponsiveDataTable columns={recentCols} data={data.recentRisks} mobileTitleKey="risk_title" mobileSubtitleKey="risk_number" pageSize={10} />
                    ) : <EmptyState title="No recent risks" message="Adjust filters or create a new risk assessment." />}
                  </TabsContent>
                  <TabsContent value="critical" className="mt-4">
                    {data.criticalRisks.length ? (
                      <ResponsiveDataTable columns={criticalCols} data={data.criticalRisks} mobileTitleKey="risk_title" mobileSubtitleKey="risk_number" pageSize={10} />
                    ) : <EmptyState title="No critical risks" message="No risks with RPN above 200 match current filters." />}
                  </TabsContent>
                  <TabsContent value="overdue" className="mt-4">
                    {data.overdueRisks.length ? (
                      <ResponsiveDataTable columns={overdueCols} data={data.overdueRisks} mobileTitleKey="risk_number" mobileSubtitleKey="risk_owner" pageSize={10} />
                    ) : <EmptyState title="No overdue risks" message="All risks are within target completion dates." />}
                  </TabsContent>
                  <TabsContent value="residual" className="mt-4">
                    {data.residualHighRisks.length ? (
                      <ResponsiveDataTable columns={residualCols} data={data.residualHighRisks} mobileTitleKey="risk_number" mobileSubtitleKey="risk_owner" pageSize={10} />
                    ) : <EmptyState title="No residual high risks" message="Residual RPN values are within acceptable limits." />}
                  </TabsContent>
                </Tabs>
              </>
            )}
          </>
        ) : null}
      </div>
    </RiskDashboardAccessGuard>
  );
}
