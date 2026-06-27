'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ClipboardList, Clock, Eye, FileText, GraduationCap, RefreshCw, Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchCcImplementationListData, escalateOverdueCcTasks } from '@/lib/cc-implementation-service';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { KpiCard } from '@/components/admin/dashboard/kpi-card';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { CcStatusBadge } from '@/components/change-control/cc-sub-nav';
import { CcImplementationAccessGuard } from './cc-implementation-access-guard';
import { CcImplStatusBadge } from './cc-implementation-badges';
import { CcImplementationCharts } from './cc-implementation-charts';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CcImplementationChartData, CcImplementationDashboardMetrics, CcImplementationPlan, ChangeControlRecord } from '@/lib/change-control-types';

type Row = CcImplementationPlan & { change?: ChangeControlRecord | null };

export function CcImplementationListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [pending, setPending] = useState<ChangeControlRecord[]>([]);
  const [metrics, setMetrics] = useState<CcImplementationDashboardMetrics>({
    totalTasks: 0, completedTasks: 0, openTasks: 0, overdueTasks: 0,
    criticalTasks: 0, validationTasks: 0, trainingTasks: 0, documentTasks: 0,
  });
  const [charts, setCharts] = useState<CcImplementationChartData>({
    statusDistribution: [], progressTrend: [], byDepartment: [], overdueTrend: [],
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await fetchCcImplementationListData();
    if ('error' in data && data.error) setError(data.error);
    setRows(data.plans);
    setMetrics(data.metrics);
    setCharts(data.charts);
    setPending((data.changes || []).filter((c) =>
      ['approved_for_implementation', 'implementation_in_progress', 'approved'].includes(c.status)
      && !data.plans.some((p) => p.change_id === c.id && !p.is_deleted),
    ));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const columns = [
    { key: 'id', header: 'Plan ID', render: (r: Row) => <span className="font-mono text-blue-600">{r.implementation_plan_id || r.id.slice(0, 8)}</span> },
    { key: 'cc', header: 'CC #', render: (r: Row) => <span className="font-mono">{r.change_control_number || r.change?.change_control_number}</span> },
    { key: 'title', header: 'Title', render: (r: Row) => <span className="max-w-[180px] truncate block">{r.implementation_title}</span> },
    { key: 'owner', header: 'Owner', render: (r: Row) => r.implementation_owner_name || '—' },
    { key: 'status', header: 'Status', render: (r: Row) => <CcImplStatusBadge status={r.implementation_status} /> },
    { key: 'progress', header: 'Progress', render: (r: Row) => (
      <div className="flex min-w-[100px] items-center gap-2">
        <Progress value={r.implementation_progress} className="h-2 flex-1" />
        <span className="text-xs tabular-nums">{r.implementation_progress}%</span>
      </div>
    ) },
    { key: 'dates', header: 'Planned', render: (r: Row) => `${r.planned_start_date} → ${r.planned_end_date}` },
    { key: 'actions', header: '', render: (r: Row) => (
      <Link href={`/qms/change-control/${r.change_id}/implementation-plan`}>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
      </Link>
    ) },
  ];

  const pendingColumns = [
    { key: 'cc', header: 'CC #', render: (r: ChangeControlRecord) => <span className="font-mono">{r.change_control_number}</span> },
    { key: 'title', header: 'Title', render: (r: ChangeControlRecord) => <span className="max-w-[200px] truncate block">{r.change_title}</span> },
    { key: 'planned', header: 'Planned Date', render: (r: ChangeControlRecord) => r.planned_implementation_date || '—' },
    { key: 'status', header: 'Status', render: (r: ChangeControlRecord) => <CcStatusBadge status={r.status} /> },
    { key: 'actions', header: '', render: (r: ChangeControlRecord) => (
      <Link href={`/qms/change-control/${r.id}/implementation-plan`}>
        <Button size="sm" variant="outline">Create Plan</Button>
      </Link>
    ) },
  ];

  const handleEscalate = async () => {
    setBusy(true);
    const n = await escalateOverdueCcTasks({ id: 'system', name: 'System' });
    setBusy(false);
    toast.success(n > 0 ? `Escalated ${n} overdue task(s)` : 'No overdue tasks');
    void load();
  };

  return (
    <CcImplementationAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Change Implementation Plan"
          description="Plan, assign and track implementation activities for approved changes"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/change-control' },
            { label: 'Change Control', href: '/qms/change-control' },
            { label: 'Implementation Plan' },
          ]}
          actions={(
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={() => void handleEscalate()} disabled={busy}>
                <AlertTriangle className="mr-2 h-4 w-4" />Escalate Overdue
              </Button>
            </div>
          )}
        />

        {loading ? <LoadingSkeleton rows={6} /> : error ? <ErrorCard message={error} onRetry={() => void load()} /> : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Total Tasks" value={metrics.totalTasks} icon={ClipboardList} />
              <KpiCard label="Completed Tasks" value={metrics.completedTasks} icon={CheckCircle2} accent="border-l-green-600" />
              <KpiCard label="Open Tasks" value={metrics.openTasks} icon={Clock} accent="border-l-amber-500" />
              <KpiCard label="Overdue Tasks" value={metrics.overdueTasks} icon={AlertTriangle} accent="border-l-red-600" />
              <KpiCard label="Critical Tasks" value={metrics.criticalTasks} icon={AlertTriangle} accent="border-l-red-500" />
              <KpiCard label="Validation Tasks" value={metrics.validationTasks} icon={Wrench} accent="border-l-violet-600" />
              <KpiCard label="Training Tasks" value={metrics.trainingTasks} icon={GraduationCap} accent="border-l-blue-600" />
              <KpiCard label="Document Tasks" value={metrics.documentTasks} icon={FileText} accent="border-l-teal-600" />
            </div>

            <CcImplementationCharts charts={charts} />

            <Tabs defaultValue="plans">
              <TabsList>
                <TabsTrigger value="plans">Implementation Plans ({rows.length})</TabsTrigger>
                <TabsTrigger value="pending">Ready for Plan ({pending.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="plans" className="mt-4">
                {rows.length === 0 ? (
                  <EmptyState title="No implementation plans" message="Create plans for approved change controls to begin implementation tracking." />
                ) : (
                  <ResponsiveDataTable columns={columns} data={rows} mobileTitleKey="implementation_title" pageSize={15} />
                )}
              </TabsContent>
              <TabsContent value="pending" className="mt-4">
                {pending.length === 0 ? (
                  <EmptyState title="No changes ready" message="Approved changes awaiting implementation plans will appear here." />
                ) : (
                  <ResponsiveDataTable columns={pendingColumns} data={pending} mobileTitleKey="change_control_number" pageSize={15} />
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </CcImplementationAccessGuard>
  );
}
