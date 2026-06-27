'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ClipboardList, Eye, RefreshCw, ShieldAlert, Target, TrendingUp,
} from 'lucide-react';
import { fetchCcRiskListData } from '@/lib/cc-risk-service';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { KpiCard } from '@/components/admin/dashboard/kpi-card';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { CcStatusBadge } from '@/components/change-control/cc-sub-nav';
import { CcRiskAccessGuard } from './cc-risk-access-guard';
import { CcRiskLevelBadge, CcRiskStatusBadge } from './cc-risk-badges';
import { CcRiskCharts } from './cc-risk-charts';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CcRiskChartData, CcRiskDashboardMetrics, ChangeControlRecord, ChangeRiskAssessment } from '@/lib/change-control-types';

type Row = ChangeRiskAssessment & { change?: ChangeControlRecord | null; rows?: ChangeRiskAssessment[] };

export function CcRiskListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [pending, setPending] = useState<ChangeControlRecord[]>([]);
  const [metrics, setMetrics] = useState<CcRiskDashboardMetrics>({
    totalRisks: 0, lowRisks: 0, mediumRisks: 0, highRisks: 0, criticalRisks: 0,
    mitigationRequired: 0, residualHighRisks: 0, capaLinkedRisks: 0,
  });
  const [charts, setCharts] = useState<CcRiskChartData>({
    riskLevelDistribution: [], residualRiskDistribution: [], categoryTrend: [],
    highRiskChanges: [], mitigationStatus: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await fetchCcRiskListData();
    if ('error' in data && data.error) setError(data.error);
    setRows(data.assessments);
    setMetrics(data.metrics);
    setCharts(data.charts);
    setPending((data.changes || []).filter((c) =>
      c.risk_assessment_required
      && !['closed', 'cancelled', 'rejected'].includes(c.status)
      && !data.assessments.some((a) => a.change_id === c.id),
    ));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const columns = [
    { key: 'id', header: 'Assessment ID', render: (r: Row) => <span className="font-mono text-blue-600">{r.risk_assessment_id || r.id.slice(0, 8)}</span> },
    { key: 'cc', header: 'CC #', render: (r: Row) => <span className="font-mono">{r.change_control_number || r.change?.change_control_number}</span> },
    { key: 'title', header: 'Title', render: (r: Row) => <span className="max-w-[180px] truncate block">{r.change?.change_title || '—'}</span> },
    { key: 'dept', header: 'Department', render: (r: Row) => r.department || '—' },
    { key: 'risks', header: 'Risks', render: (r: Row) => r.rows?.length ?? 0 },
    { key: 'level', header: 'Overall Risk', render: (r: Row) => <CcRiskLevelBadge level={r.risk_level} /> },
    { key: 'status', header: 'Status', render: (r: Row) => <CcRiskStatusBadge status={r.status} /> },
    { key: 'date', header: 'Assessed', render: (r: Row) => r.assessment_date || r.assessed_at?.split('T')[0] || '—' },
    { key: 'actions', header: '', render: (r: Row) => (
      <Link href={`/qms/change-control/${r.change_id}/risk-assessment`}>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
      </Link>
    ) },
  ];

  const pendingColumns = [
    { key: 'cc', header: 'CC #', render: (r: ChangeControlRecord) => <span className="font-mono">{r.change_control_number}</span> },
    { key: 'title', header: 'Title', render: (r: ChangeControlRecord) => <span className="max-w-[200px] truncate block">{r.change_title}</span> },
    { key: 'cat', header: 'Category', render: (r: ChangeControlRecord) => <CcRiskLevelBadge level={r.change_category} /> },
    { key: 'status', header: 'Status', render: (r: ChangeControlRecord) => <CcStatusBadge status={r.status} /> },
    { key: 'actions', header: '', render: (r: ChangeControlRecord) => (
      <Link href={`/qms/change-control/${r.id}/risk-assessment`}>
        <Button size="sm" variant="outline">Start Assessment</Button>
      </Link>
    ) },
  ];

  return (
    <CcRiskAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Change Risk Assessment"
          description="Evaluate and control risks associated with proposed GMP changes"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/change-control' },
            { label: 'Change Control', href: '/qms/change-control' },
            { label: 'Risk Assessment' },
          ]}
          actions={(
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCw className="mr-2 h-4 w-4" />Refresh
            </Button>
          )}
        />

        {loading ? <LoadingSkeleton rows={6} /> : error ? (
          <ErrorCard message={error} onRetry={() => void load()} />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              <KpiCard label="Total Risks" value={metrics.totalRisks} icon={ClipboardList} accent="blue" />
              <KpiCard label="Low" value={metrics.lowRisks} icon={CheckCircle2} accent="green" />
              <KpiCard label="Medium" value={metrics.mediumRisks} icon={Target} accent="amber" />
              <KpiCard label="High" value={metrics.highRisks} icon={TrendingUp} accent="orange" />
              <KpiCard label="Critical" value={metrics.criticalRisks} icon={AlertTriangle} accent="red" />
              <KpiCard label="Mitigation Req." value={metrics.mitigationRequired} icon={ShieldAlert} accent="purple" />
              <KpiCard label="Residual High" value={metrics.residualHighRisks} icon={AlertTriangle} accent="red" />
              <KpiCard label="CAPA Linked" value={metrics.capaLinkedRisks} icon={ClipboardList} accent="blue" />
            </div>

            <CcRiskCharts charts={charts} />

            <Tabs defaultValue="assessments">
              <TabsList>
                <TabsTrigger value="assessments">Assessments</TabsTrigger>
                <TabsTrigger value="pending">Pending Queue</TabsTrigger>
              </TabsList>
              <TabsContent value="assessments" className="mt-4">
                {rows.length === 0 ? (
                  <EmptyState title="No risk assessments" message="Start an assessment from the pending queue." />
                ) : (
                  <ResponsiveDataTable columns={columns} data={rows} />
                )}
              </TabsContent>
              <TabsContent value="pending" className="mt-4">
                {pending.length === 0 ? (
                  <EmptyState title="Queue empty" message="No change controls currently require risk assessment." />
                ) : (
                  <ResponsiveDataTable columns={pendingColumns} data={pending} />
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </CcRiskAccessGuard>
  );
}
