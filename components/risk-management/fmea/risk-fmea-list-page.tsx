'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Eye, RefreshCw, ShieldAlert } from 'lucide-react';
import { fetchFmeaDashboardData } from '@/lib/risk-fmea-service';
import type { RiskFmeaChartData, RiskFmeaRecord } from '@/lib/risk-fmea-records';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { KpiCard } from '@/components/admin/dashboard/kpi-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { RiskFmeaAccessGuard } from './risk-fmea-access-guard';
import { FmeaStatusBadge } from './risk-fmea-badges';
import { RiskFmeaCharts } from './risk-fmea-charts';
import { Button } from '@/components/ui/button';

type Row = RiskFmeaRecord & { id: string };

export function RiskFmeaListPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<Row[]>([]);
  const [metrics, setMetrics] = useState({
    totalFailureModes: 0,
    lowRisks: 0,
    mediumRisks: 0,
    highRisks: 0,
    criticalRisks: 0,
    mitigationPending: 0,
    mitigationCompleted: 0,
    residualHighRisks: 0,
  });
  const [charts, setCharts] = useState<RiskFmeaChartData | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchFmeaDashboardData();
      setRecords(data.fmeaRecords as Row[]);
      setMetrics(data.metrics);
      setCharts(data.charts);
    } catch {
      setError('Failed to load FMEA dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const columns = useMemo(() => [
    { key: 'risk_number', header: 'Risk No', render: (r: Row) => <span className="font-mono text-blue-600">{r.risk_number}</span> },
    { key: 'title', header: 'FMEA Title', render: (r: Row) => r.fmea_title },
    { key: 'department', header: 'Department', render: (r: Row) => r.department },
    { key: 'product', header: 'Product', render: (r: Row) => r.product || '—' },
    { key: 'highest', header: 'Highest RPN', render: (r: Row) => r.highest_rpn || 0 },
    { key: 'residual', header: 'Residual Highest', render: (r: Row) => r.highest_residual_rpn || 0 },
    { key: 'status', header: 'Status', render: (r: Row) => <FmeaStatusBadge status={r.status} /> },
    { key: 'actions', header: 'Action', render: (r: Row) => (
      <Link href={`/qms/risk-management/${r.risk_assessment_id}/fmea`}>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
      </Link>
    ) },
  ], []);

  return (
    <RiskFmeaAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="FMEA Risk Assessment"
          description="Failure Mode and Effects Analysis for GMP risk evaluation"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/risk-management/audit-trail' },
            { label: 'Risk Management', href: '/qms/risk-management/audit-trail' },
            { label: 'FMEA Assessment' },
          ]}
          actions={(
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className="mr-1 h-4 w-4" />Refresh
            </Button>
          )}
        />

        {loading ? <LoadingSkeleton rows={2} /> : error ? (
          <ErrorCard title="Load error" message={error} onRetry={load} />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
              <KpiCard label="Total Failure Modes" value={metrics.totalFailureModes} icon={ShieldAlert} accent="border-l-blue-600" />
              <KpiCard label="Low Risks" value={metrics.lowRisks} accent="border-l-green-600" />
              <KpiCard label="Medium Risks" value={metrics.mediumRisks} accent="border-l-amber-500" />
              <KpiCard label="High Risks" value={metrics.highRisks} accent="border-l-orange-600" />
              <KpiCard label="Critical Risks" value={metrics.criticalRisks} accent="border-l-red-600" />
              <KpiCard label="Mitigation Pending" value={metrics.mitigationPending} accent="border-l-amber-600" />
              <KpiCard label="Mitigation Completed" value={metrics.mitigationCompleted} icon={CheckCircle2} accent="border-l-green-600" />
              <KpiCard label="Residual High Risks" value={metrics.residualHighRisks} accent="border-l-red-600" />
            </div>

            {charts ? <RiskFmeaCharts charts={charts} /> : null}

            {records.length ? (
              <ResponsiveDataTable columns={columns} data={records} mobileTitleKey="fmea_title" mobileSubtitleKey="risk_number" pageSize={15} />
            ) : (
              <EmptyState title="No FMEA assessments" message="Create an FMEA worksheet from a risk assessment." />
            )}
          </>
        )}
      </div>
    </RiskFmeaAccessGuard>
  );
}
