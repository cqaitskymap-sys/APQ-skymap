'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, Bell, Download, Eye, FileSpreadsheet, FileText, Plus, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useAuth } from '@/contexts/auth-context';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  PQR_STATUSES, canExportPqrDashboard, type PqrDashboardData, type PqrDashboardFilters,
} from '@/lib/pqr-dashboard-records';
import {
  fetchPqrDashboard, fetchPqrProductOptions, fetchPqrYearOptions,
  logPqrDashboardExport, logPqrDashboardFilter, logPqrDashboardView,
  logPqrOpened, refreshPqrDashboard,
} from '@/lib/pqr-dashboard-service';
import { subscribeToNotifications, type NotificationRecord } from '@/lib/notification-service';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { PqrDashboardAccessGuard } from './pqr-dashboard-access-guard';
import { PqrRiskBadge, PqrStatusBadge } from './pqr-dashboard-badges';
import { ActivityTimeline } from './activity-timeline';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ColumnDef } from '@/components/admin/admin-data-table';
import type {
  PqrCriticalAlertRow, PqrDueRow, PqrPendingApprovalRow, PqrRecordRow,
} from '@/lib/pqr-dashboard-records';

const CHART_COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#64748b'];

function SafeChart({
  title, description, height = 'h-56', children, empty,
}: {
  title: string;
  description?: string;
  height?: string;
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className={height}>
        {empty ? <EmptyState title="No data" message="No records for the selected filters." /> : children}
      </CardContent>
    </Card>
  );
}

export function PqrDashboardPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const role = profile?.role;
  const canExport = canExportPqrDashboard(role);

  const [data, setData] = useState<PqrDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<string[]>([]);
  const [years, setYears] = useState<string[]>([]);
  const [pqrNotifications, setPqrNotifications] = useState<NotificationRecord[]>([]);

  const [filters, setFilters] = useState<PqrDashboardFilters>({
    product: 'all',
    reviewYear: 'all',
    status: 'all',
    dateFrom: '',
    dateTo: '',
  });

  const actor = useMemo(() => ({
    id: user?.uid || 'system',
    name: profile?.full_name || profile?.email || 'System',
    role,
  }), [user?.uid, profile?.full_name, profile?.email, role]);

  const loadOptions = useCallback(async () => {
    const [p, y] = await Promise.all([fetchPqrProductOptions(), fetchPqrYearOptions()]);
    setProducts(p);
    setYears(y);
  }, []);

  const load = useCallback(async (opts?: { refresh?: boolean }) => {
    if (opts?.refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      if (!isFirebaseConfigured()) {
        setError('Firebase is not configured. Set environment variables to load live PQR data.');
        setData(null);
        return;
      }
      const result = opts?.refresh
        ? await refreshPqrDashboard(actor, filters)
        : await fetchPqrDashboard(filters);
      setData(result);
    } catch {
      setError('Failed to load PQR dashboard data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [actor, filters]);

  useEffect(() => { void loadOptions(); }, [loadOptions]);
  useEffect(() => {
    void load();
    void logPqrDashboardView(actor);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user?.uid || !isFirebaseConfigured()) return;
    const unsub = subscribeToNotifications(user.uid, (rows) => {
      setPqrNotifications(rows.filter((n) =>
        String(n.moduleName || '').toLowerCase().includes('pqr'),
      ).slice(0, 5));
    });
    return () => unsub();
  }, [user?.uid]);

  const applyFilters = () => {
    void logPqrDashboardFilter(actor, filters);
    void load();
    toast.success('Filters applied');
  };

  const handleRefresh = () => {
    void load({ refresh: true });
    toast.success('Dashboard refreshed');
  };

  const setStatusFilter = (status: string) => {
    setFilters((f) => ({ ...f, status }));
    void logPqrDashboardFilter(actor, { ...filters, status });
    void fetchPqrDashboard({ ...filters, status }).then(setData);
  };

  const exportPdf = () => {
    void logPqrDashboardExport(actor, 'pdf');
    toast.info('PDF export will be available in a future release.');
  };

  const exportExcel = () => {
    void logPqrDashboardExport(actor, 'excel');
    toast.info('Excel export will be available in a future release.');
  };

  const openPqr = (id: string) => {
    void logPqrOpened(actor, id);
    router.push(`/pqr/${id}`);
  };

  const recentColumns: ColumnDef<PqrRecordRow>[] = [
    { key: 'pqrNumber', header: 'PQR Number' },
    { key: 'product', header: 'Product' },
    { key: 'reviewPeriod', header: 'Review Period', render: (r) => <span className="line-clamp-1 max-w-[140px]">{r.reviewPeriod || '—'}</span> },
    { key: 'status', header: 'Status', render: (r) => <PqrStatusBadge status={r.status} /> },
    { key: 'preparedBy', header: 'Prepared By' },
    { key: 'pendingWith', header: 'Pending With' },
    { key: 'createdDate', header: 'Created Date' },
    {
      key: 'actions', header: 'Action',
      render: (r) => (
        <Button variant="ghost" size="icon" onClick={() => openPqr(r.id)}>
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  const dueColumns: ColumnDef<PqrDueRow>[] = [
    { key: 'product', header: 'Product' },
    { key: 'reviewYear', header: 'Review Year' },
    { key: 'dueDate', header: 'Due Date' },
    { key: 'daysOverdue', header: 'Days Overdue', render: (r) => (
      <span className={r.daysOverdue > 0 ? 'font-semibold text-red-600' : ''}>{r.daysOverdue}</span>
    ) },
    { key: 'owner', header: 'Owner' },
    { key: 'status', header: 'Status', render: (r) => <PqrStatusBadge status={r.status} /> },
    {
      key: 'actions', header: 'Action',
      render: (r) => (
        <Button variant="ghost" size="icon" onClick={() => openPqr(r.id)}>
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  const approvalColumns: ColumnDef<PqrPendingApprovalRow>[] = [
    { key: 'pqrNumber', header: 'PQR Number' },
    { key: 'product', header: 'Product' },
    { key: 'currentStep', header: 'Current Step' },
    { key: 'pendingWith', header: 'Pending With' },
    { key: 'dueDate', header: 'Due Date' },
    { key: 'priority', header: 'Priority', render: (r) => <PqrRiskBadge level={r.priority === 'High' ? 'High' : 'Medium'} /> },
    {
      key: 'actions', header: 'Action',
      render: (r) => (
        <Button variant="ghost" size="icon" onClick={() => r.pqrId && openPqr(r.pqrId)}>
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  const alertColumns: ColumnDef<PqrCriticalAlertRow>[] = [
    { key: 'product', header: 'Product' },
    { key: 'batchNo', header: 'Batch No' },
    { key: 'source', header: 'Source' },
    { key: 'issue', header: 'Issue', render: (r) => <span className="line-clamp-2 max-w-[180px]">{r.issue}</span> },
    { key: 'riskLevel', header: 'Risk Level', render: (r) => <PqrRiskBadge level={r.riskLevel} /> },
    { key: 'status', header: 'Status', render: (r) => <PqrStatusBadge status={r.status} /> },
    { key: 'actions', header: 'Action', render: () => <AlertTriangle className="h-4 w-4 text-amber-500" /> },
  ];

  const kpis = data?.kpis;
  const charts = data?.charts;

  if (loading && !data) {
    return (
      <PqrDashboardAccessGuard>
        <div className="p-4 sm:p-6"><LoadingSkeleton rows={3} /></div>
      </PqrDashboardAccessGuard>
    );
  }

  if (error) {
    return (
      <PqrDashboardAccessGuard>
        <div className="p-4 sm:p-6"><ErrorCard message={error} onRetry={() => void load()} /></div>
      </PqrDashboardAccessGuard>
    );
  }

  return (
    <PqrDashboardAccessGuard>
      <div className="space-y-6 p-4 sm:p-6">
        <CpvPageHeader
          title="PQR Dashboard"
          description="Product Quality Review overview, annual review status and quality performance"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'PQR Management', href: '/pqr/dashboard' },
            { label: 'PQR Dashboard' },
          ]}
          actions={(
            <>
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              {canExport && (
                <>
                  <Button variant="outline" size="sm" onClick={exportPdf}>
                    <FileText className="h-4 w-4 mr-1" />PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportExcel}>
                    <FileSpreadsheet className="h-4 w-4 mr-1" />Excel
                  </Button>
                </>
              )}
              <Link href="/pqr/create">
                <Button size="sm"><Plus className="h-4 w-4 mr-1" />Create PQR</Button>
              </Link>
            </>
          )}
        />

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <Select value={filters.product || 'all'} onValueChange={(v) => setFilters((f) => ({ ...f, product: v }))}>
                <SelectTrigger><SelectValue placeholder="Product" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {products.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filters.reviewYear || 'all'} onValueChange={(v) => setFilters((f) => ({ ...f, reviewYear: v }))}>
                <SelectTrigger><SelectValue placeholder="Review Year" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filters.status || 'all'} onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {PQR_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="date" value={filters.dateFrom || ''} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))} />
              <Input type="date" value={filters.dateTo || ''} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))} />
              <Button onClick={applyFilters}>Apply Filters</Button>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        {kpis && (
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-11">
            {[
              { label: 'Total PQRs', value: kpis.totalPqrs, onClick: () => setStatusFilter('all') },
              { label: 'Draft PQRs', value: kpis.draftPqrs, tone: 'amber' as const, onClick: () => setStatusFilter('Draft') },
              { label: 'Under Review', value: kpis.underReviewPqrs, tone: 'amber' as const, onClick: () => setStatusFilter('Under Review') },
              { label: 'Approved', value: kpis.approvedPqrs, tone: 'green' as const, onClick: () => setStatusFilter('Approved') },
              { label: 'Rejected', value: kpis.rejectedPqrs, tone: 'red' as const, onClick: () => setStatusFilter('Rejected') },
              { label: 'Archived', value: kpis.archivedPqrs, onClick: () => setStatusFilter('Archived') },
              { label: 'Due This Month', value: kpis.pqrsDueThisMonth, tone: 'amber' as const },
              { label: 'Overdue', value: kpis.overduePqrs, tone: 'red' as const },
              { label: 'Products Reviewed', value: kpis.totalProductsReviewed },
              { label: 'Batches Reviewed', value: kpis.totalBatchesReviewed },
              { label: 'Released Batches', value: kpis.releasedBatches, tone: 'green' as const },
              { label: 'Rejected Batches', value: kpis.rejectedBatches, tone: 'red' as const },
              { label: 'Deviations', value: kpis.deviationCount, tone: 'amber' as const },
              { label: 'OOS', value: kpis.oosCount, tone: 'red' as const },
              { label: 'CAPA', value: kpis.capaCount },
              { label: 'Change Controls', value: kpis.changeControlCount },
              { label: 'Complaints', value: kpis.marketComplaintCount, tone: 'amber' as const },
              { label: 'Recalls', value: kpis.recallCount, tone: 'red' as const },
              { label: 'Avg Yield %', value: `${kpis.averageYieldPct}%` },
              { label: 'Avg Assay %', value: `${kpis.averageAssayPct}%` },
              { label: 'Avg Cpk', value: kpis.averageCpk },
              { label: 'Open Risks', value: kpis.openRisks, tone: 'red' as const },
              { label: 'Pending Approvals', value: kpis.pendingApprovals, tone: 'amber' as const },
            ].map((k) => (
              <button
                key={k.label}
                type="button"
                className="text-left"
                onClick={k.onClick}
                disabled={!k.onClick}
              >
                <KpiCard label={k.label} value={k.value} tone={k.tone} />
              </button>
            ))}
          </div>
        )}

        {/* Charts */}
        {charts && (
          <div className="grid gap-4 lg:grid-cols-2">
            <SafeChart title="PQR Status Distribution" empty={!charts.statusDistribution.length}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={charts.statusDistribution} dataKey="value" nameKey="name" outerRadius={80} label>
                    {charts.statusDistribution.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </SafeChart>

            <SafeChart title="Monthly PQR Creation Trend" empty={!charts.monthlyCreationTrend.length}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.monthlyCreationTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </SafeChart>

            <SafeChart title="Product-wise PQR Status" empty={!charts.productStatus.length}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.productStatus}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="product" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="draft" fill="#64748b" name="Draft" />
                  <Bar dataKey="review" fill="#d97706" name="Under Review" />
                  <Bar dataKey="approved" fill="#059669" name="Approved" />
                </BarChart>
              </ResponsiveContainer>
            </SafeChart>

            <SafeChart title="Batch Release vs Rejection Trend" empty={!charts.batchReleaseTrend.length}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.batchReleaseTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="released" fill="#059669" name="Released" />
                  <Bar dataKey="rejected" fill="#dc2626" name="Rejected" />
                </BarChart>
              </ResponsiveContainer>
            </SafeChart>

            <SafeChart title="Deviation / OOS / CAPA Trend" empty={!charts.qualityTrend.length}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.qualityTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="deviations" stroke="#2563eb" name="Deviations" />
                  <Line type="monotone" dataKey="oos" stroke="#dc2626" name="OOS" />
                  <Line type="monotone" dataKey="capa" stroke="#d97706" name="CAPA" />
                </LineChart>
              </ResponsiveContainer>
            </SafeChart>

            <SafeChart title="Yield Trend" empty={!charts.yieldTrend.length}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.yieldTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#059669" name="Yield %" />
                </LineChart>
              </ResponsiveContainer>
            </SafeChart>

            <SafeChart title="Assay Trend" empty={!charts.assayTrend.length}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.assayTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#2563eb" name="Assay %" />
                </LineChart>
              </ResponsiveContainer>
            </SafeChart>

            <SafeChart title="Stability Trend" empty={!charts.stabilityTrend.length}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.stabilityTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#7c3aed" name="Result" />
                </LineChart>
              </ResponsiveContainer>
            </SafeChart>

            <SafeChart title="Complaint & Recall Trend" empty={!charts.complaintRecallTrend.length}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.complaintRecallTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="complaints" fill="#d97706" name="Complaints" />
                  <Bar dataKey="recalls" fill="#dc2626" name="Recalls" />
                </BarChart>
              </ResponsiveContainer>
            </SafeChart>

            <SafeChart title="Approval Pending Trend" empty={!charts.approvalPendingTrend.length}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.approvalPendingTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#d97706" name="Pending" />
                </LineChart>
              </ResponsiveContainer>
            </SafeChart>
          </div>
        )}

        {/* Tables */}
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Recent PQRs</CardTitle></CardHeader>
            <CardContent>
              {data?.recentPqrs?.length ? (
                <ResponsiveDataTable
                  columns={recentColumns}
                  data={data.recentPqrs}
                  searchKeys={['pqrNumber', 'product', 'preparedBy']}
                  mobileTitleKey="pqrNumber"
                  mobileSubtitleKey="product"
                  pageSize={10}
                />
              ) : (
                <EmptyState title="No PQR records" message="Create a PQR to begin annual product quality review." />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">PQRs Due / Overdue</CardTitle></CardHeader>
            <CardContent>
              {data?.duePqrs?.length ? (
                <ResponsiveDataTable
                  columns={dueColumns}
                  data={data.duePqrs}
                  searchKeys={['product', 'owner']}
                  mobileTitleKey="product"
                  mobileSubtitleKey="dueDate"
                  pageSize={10}
                />
              ) : (
                <EmptyState title="No overdue PQRs" message="All annual reviews are on schedule." />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Pending Approvals</CardTitle></CardHeader>
            <CardContent>
              {data?.pendingApprovals?.length ? (
                <ResponsiveDataTable
                  columns={approvalColumns}
                  data={data.pendingApprovals}
                  searchKeys={['pqrNumber', 'product', 'pendingWith']}
                  mobileTitleKey="pqrNumber"
                  mobileSubtitleKey="product"
                  pageSize={10}
                />
              ) : (
                <EmptyState title="No pending approvals" message="All PQR approval steps are complete." />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Critical Quality Alerts</CardTitle></CardHeader>
            <CardContent>
              {data?.criticalAlerts?.length ? (
                <ResponsiveDataTable
                  columns={alertColumns}
                  data={data.criticalAlerts}
                  searchKeys={['product', 'batchNo', 'issue']}
                  mobileTitleKey="product"
                  mobileSubtitleKey="issue"
                  pageSize={10}
                />
              ) : (
                <EmptyState title="No critical alerts" message="No open OOS, deviation, or recall alerts." />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Activity + Notifications */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
            <CardContent>
              <ActivityTimeline entries={data?.activity || []} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">PQR Notifications</CardTitle>
              <Link href="/notifications" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                <Bell className="h-4 w-4" />View all
              </Link>
            </CardHeader>
            <CardContent>
              {pqrNotifications.length ? (
                <ul className="space-y-3">
                  {pqrNotifications.map((n) => (
                    <li key={n.id} className="rounded-md border p-3 text-sm">
                      <p className="font-medium">{n.title}</p>
                      <p className="text-muted-foreground line-clamp-2">{n.message}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No PQR notifications" message="Workflow alerts will appear here." />
              )}
            </CardContent>
          </Card>
        </div>

        {data?.generatedAt && (
          <p className="text-xs text-muted-foreground text-right">
            Last updated: {new Date(data.generatedAt).toLocaleString()}
          </p>
        )}
      </div>
    </PqrDashboardAccessGuard>
  );
}
