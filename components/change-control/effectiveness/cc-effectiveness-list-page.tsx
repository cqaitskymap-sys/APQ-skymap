'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, BarChart3, CheckCircle2, ClipboardList, Eye, RefreshCw, ShieldCheck, Target, XCircle,
} from 'lucide-react';
import { fetchCcEffectivenessListData } from '@/lib/cc-effectiveness-service';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { KpiCard } from '@/components/admin/dashboard/kpi-card';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { CcStatusBadge } from '@/components/change-control/cc-sub-nav';
import { CcEffectivenessAccessGuard } from './cc-effectiveness-access-guard';
import {
  CcEffectivenessResultBadge,
  CcEffectivenessScoreBadge,
  CcEffectivenessStatusBadge,
  CcRiskBadge,
} from './cc-effectiveness-badges';
import { CcEffectivenessProgress } from './cc-effectiveness-progress';
import { CcEffectivenessCharts } from './cc-effectiveness-charts';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CcEffectivenessChartData, CcEffectivenessDashboardMetrics, ChangeControlRecord, ChangeEffectivenessReview } from '@/lib/change-control-types';

type Row = ChangeEffectivenessReview & { change?: ChangeControlRecord | null };

export function CcEffectivenessListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [pending, setPending] = useState<ChangeControlRecord[]>([]);
  const [metrics, setMetrics] = useState<CcEffectivenessDashboardMetrics>({
    total: 0, pendingReviews: 0, effective: 0, partiallyEffective: 0,
    notEffective: 0, capaRecommended: 0, criticalUnderReview: 0, averageScore: 0,
  });
  const [charts, setCharts] = useState<CcEffectivenessChartData>({
    resultDistribution: [], monthlyTrend: [], byDepartment: [], byChangeType: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await fetchCcEffectivenessListData();
    if ('error' in data && data.error) setError(data.error);
    setRows(data.reviews);
    setMetrics(data.metrics);
    setCharts(data.charts);
    setPending((data.changes || []).filter((c) =>
      c.effectiveness_check_required
      && ['implemented', 'effectiveness_pending', 'implementation_in_progress'].includes(c.status)
      && !data.reviews.some((r) => r.change_id === c.id && !r.is_deleted),
    ));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const reviewColumns = [
    { key: 'eff_id', header: 'Review ID', render: (r: Row) => <span className="font-mono text-blue-600">{r.effectiveness_review_id || r.id.slice(0, 8)}</span> },
    { key: 'cc', header: 'CC #', render: (r: Row) => <span className="font-mono">{r.change_control_number || r.change?.change_control_number || '—'}</span> },
    { key: 'title', header: 'Title', render: (r: Row) => <span className="max-w-[180px] truncate block">{r.change?.change_title || '—'}</span> },
    { key: 'dept', header: 'Department', render: (r: Row) => r.department || r.change?.department || '—' },
    { key: 'date', header: 'Review Date', render: (r: Row) => r.review_date || '—' },
    { key: 'result', header: 'Result', render: (r: Row) => <CcEffectivenessResultBadge result={r.effectiveness_result || r.result} /> },
    { key: 'score', header: 'Score', render: (r: Row) => <CcEffectivenessScoreBadge score={r.effectiveness_score} /> },
    { key: 'status', header: 'Status', render: (r: Row) => <CcEffectivenessStatusBadge status={r.status} /> },
    { key: 'progress', header: 'Progress', render: (r: Row) => <CcEffectivenessProgress review={r} /> },
    { key: 'risk', header: 'Category', render: (r: Row) => <CcRiskBadge category={r.change?.change_category} /> },
    { key: 'actions', header: '', render: (r: Row) => (
      <Link href={`/qms/change-control/${r.change_id}/effectiveness-review`}>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
      </Link>
    ) },
  ];

  const pendingColumns = [
    { key: 'cc', header: 'CC #', render: (r: ChangeControlRecord) => <span className="font-mono">{r.change_control_number}</span> },
    { key: 'title', header: 'Title', render: (r: ChangeControlRecord) => <span className="max-w-[200px] truncate block">{r.change_title}</span> },
    { key: 'impl', header: 'Implemented', render: (r: ChangeControlRecord) => r.actual_implementation_date || '—' },
    { key: 'status', header: 'Status', render: (r: ChangeControlRecord) => <CcStatusBadge status={r.status} /> },
    { key: 'cat', header: 'Category', render: (r: ChangeControlRecord) => <CcRiskBadge category={r.change_category} /> },
    { key: 'actions', header: '', render: (r: ChangeControlRecord) => (
      <Link href={`/qms/change-control/${r.id}/effectiveness-review`}>
        <Button size="sm" variant="outline">Start Review</Button>
      </Link>
    ) },
  ];

  return (
    <CcEffectivenessAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Change Effectiveness Review"
          description="Verify that implemented changes achieved intended GMP objectives"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/change-control' },
            { label: 'Change Control', href: '/qms/change-control' },
            { label: 'Effectiveness Review' },
          ]}
          actions={(
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh
            </Button>
          )}
        />

        {loading ? <LoadingSkeleton rows={6} /> : error ? <ErrorCard message={error} onRetry={() => void load()} /> : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Total Reviews" value={metrics.total} icon={ClipboardList} />
              <KpiCard label="Pending Reviews" value={metrics.pendingReviews} icon={Target} accent="border-l-amber-500" />
              <KpiCard label="Effective Changes" value={metrics.effective} icon={CheckCircle2} accent="border-l-green-600" />
              <KpiCard label="Partially Effective" value={metrics.partiallyEffective} icon={BarChart3} accent="border-l-amber-600" />
              <KpiCard label="Not Effective" value={metrics.notEffective} icon={XCircle} accent="border-l-red-600" />
              <KpiCard label="CAPA Recommended" value={metrics.capaRecommended} icon={AlertTriangle} accent="border-l-orange-500" />
              <KpiCard label="Critical Under Review" value={metrics.criticalUnderReview} icon={ShieldCheck} accent="border-l-purple-600" />
              <KpiCard label="Avg Effectiveness Score" value={`${metrics.averageScore}%`} icon={BarChart3} accent="border-l-blue-600" />
            </div>

            <CcEffectivenessCharts charts={charts} />

            <Tabs defaultValue="reviews">
              <TabsList>
                <TabsTrigger value="reviews">All Reviews ({rows.length})</TabsTrigger>
                <TabsTrigger value="pending">Pending Queue ({pending.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="reviews" className="mt-4">
                {rows.length === 0 ? (
                  <EmptyState title="No effectiveness reviews" message="Reviews will appear after post-implementation effectiveness checks are initiated." />
                ) : (
                  <ResponsiveDataTable columns={reviewColumns} data={rows} mobileTitleKey="change_control_number" pageSize={15} />
                )}
              </TabsContent>
              <TabsContent value="pending" className="mt-4">
                {pending.length === 0 ? (
                  <EmptyState title="No pending changes" message="All implemented changes requiring effectiveness review have been started." />
                ) : (
                  <ResponsiveDataTable columns={pendingColumns} data={pending} mobileTitleKey="change_control_number" mobileSubtitleKey="change_title" pageSize={15} />
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </CcEffectivenessAccessGuard>
  );
}
