'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ClipboardList, Clock, Eye, RefreshCw, ShieldCheck, Target, XCircle,
} from 'lucide-react';
import { fetchCapaEffectivenessDashboard } from '@/lib/capa-effectiveness-service';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { KpiCard } from '@/components/admin/dashboard/kpi-card';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { CapaStatusBadge, CapaPriorityBadge } from '@/components/capa/capa-sub-nav';
import { CapaEffectivenessAccessGuard } from './capa-effectiveness-access-guard';
import {
  CapaEffectivenessResultBadge,
  CapaEffectivenessScoreBadge,
  CapaEffectivenessStatusBadge,
} from './capa-effectiveness-badges';
import { CapaEffectivenessProgress } from './capa-effectiveness-progress';
import { CapaEffectivenessCharts } from './capa-effectiveness-charts';
import { Button } from '@/components/ui/button';
import type { CapaEffectiveness, CapaEffectivenessChartData, CapaRecord } from '@/lib/capa-types';

type Row = CapaEffectiveness & { capa?: CapaRecord | null };

export function CapaEffectivenessListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [metrics, setMetrics] = useState({
    total: 0, pendingReviews: 0, effective: 0, partiallyEffective: 0,
    notEffective: 0, reassessmentRequired: 0, overdue: 0, readyForClosure: 0,
  });
  const [charts, setCharts] = useState<CapaEffectivenessChartData>({
    resultDistribution: [], monthlyTrend: [], byDepartment: [], bySource: [], effectiveTrend: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const data = await fetchCapaEffectivenessDashboard();
      if (data.error) setError(data.error);
      setRows(data.reviews);
      setMetrics(data.metrics);
      setCharts(data.charts);
      setLoading(false);
    })();
  }, []);

  const columns = [
    { key: 'effectiveness_id', header: 'Review ID', render: (r: Row) => <span className="font-mono text-blue-600">{r.effectiveness_id || r.id.slice(0, 8)}</span> },
    { key: 'capa_number', header: 'CAPA #', render: (r: Row) => <span className="font-mono">{r.capa_number || r.capa?.capa_number || '—'}</span> },
    { key: 'source', header: 'Source', render: (r: Row) => `${r.source_type || r.capa?.capa_source || '—'} (${r.source_reference_number || '—'})` },
    { key: 'department', header: 'Department', render: (r: Row) => r.department || r.capa?.department || '—' },
    { key: 'due', header: 'Due Date', render: (r: Row) => r.effectiveness_due_date || '—' },
    { key: 'result', header: 'Result', render: (r: Row) => <CapaEffectivenessResultBadge result={r.effectiveness_result || r.result} /> },
    { key: 'score', header: 'Score', render: (r: Row) => <CapaEffectivenessScoreBadge score={r.effectiveness_score} /> },
    { key: 'status', header: 'Status', render: (r: Row) => <CapaEffectivenessStatusBadge status={r.status} /> },
    { key: 'progress', header: 'Progress', render: (r: Row) => <CapaEffectivenessProgress review={r} /> },
    { key: 'priority', header: 'Priority', render: (r: Row) => r.capa ? <CapaPriorityBadge priority={r.capa.priority} /> : '—' },
    { key: 'capa_status', header: 'CAPA Status', render: (r: Row) => r.capa ? <CapaStatusBadge status={r.capa.capa_status} /> : '—' },
    { key: 'actions', header: '', render: (r: Row) => (
      <Link href={`/qms/capa/${r.capa_id}/effectiveness`}>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
      </Link>
    ) },
  ];

  return (
    <CapaEffectivenessAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="CAPA Effectiveness Check"
          description="Evaluate whether implemented CAPA actions eliminated root cause and prevented recurrence"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/capa' },
            { label: 'CAPA Management', href: '/qms/capa' },
            { label: 'Effectiveness Check' },
          ]}
        />

        {loading ? <LoadingSkeleton rows={3} /> : error ? (
          <ErrorCard title="Load error" message={error} />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
              <KpiCard label="Total Effectiveness Reviews" value={metrics.total} icon={ClipboardList} />
              <KpiCard label="Pending Reviews" value={metrics.pendingReviews} icon={Clock} accent="border-l-amber-500" />
              <KpiCard label="Effective CAPA" value={metrics.effective} icon={CheckCircle2} accent="border-l-green-600" />
              <KpiCard label="Partially Effective" value={metrics.partiallyEffective} icon={Target} accent="border-l-orange-500" />
              <KpiCard label="Not Effective" value={metrics.notEffective} icon={XCircle} accent="border-l-red-600" />
              <KpiCard label="Reassessment Required" value={metrics.reassessmentRequired} icon={RefreshCw} accent="border-l-purple-600" />
              <KpiCard label="Overdue Reviews" value={metrics.overdue} icon={AlertTriangle} accent="border-l-red-600" />
              <KpiCard label="CAPA Ready For Closure" value={metrics.readyForClosure} icon={ShieldCheck} accent="border-l-teal-600" />
            </div>

            <CapaEffectivenessCharts charts={charts} />

            {rows.length ? (
              <ResponsiveDataTable columns={columns} data={rows} mobileTitleKey="capa_number" mobileSubtitleKey="effectiveness_id" pageSize={15} />
            ) : (
              <EmptyState title="No effectiveness reviews yet" message="Schedule effectiveness reviews after corrective and preventive actions are closed." />
            )}
          </>
        )}
      </div>
    </CapaEffectivenessAccessGuard>
  );
}
