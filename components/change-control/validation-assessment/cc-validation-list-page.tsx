'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ClipboardList, Eye, RefreshCw, ShieldCheck, Target,
} from 'lucide-react';
import { fetchCcValidationListData } from '@/lib/cc-validation-service';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { KpiCard } from '@/components/admin/dashboard/kpi-card';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { CcStatusBadge } from '@/components/change-control/cc-sub-nav';
import { CcRiskBadge } from '@/components/change-control/effectiveness/cc-effectiveness-badges';
import { CcValidationAccessGuard } from './cc-validation-access-guard';
import {
  CcImpactBadge,
  CcValidationCategoryBadge,
  CcValidationStatusBadge,
} from './cc-validation-badges';
import { CcValidationProgress } from './cc-validation-progress';
import { CcValidationCharts } from './cc-validation-charts';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CcValidationAssessment, CcValidationChartData, CcValidationDashboardMetrics, ChangeControlRecord } from '@/lib/change-control-types';

type Row = CcValidationAssessment & { change?: ChangeControlRecord | null };

export function CcValidationListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [pending, setPending] = useState<ChangeControlRecord[]>([]);
  const [metrics, setMetrics] = useState<CcValidationDashboardMetrics>({
    total: 0, validationRequired: 0, csvAssessments: 0, revalidationRequired: 0,
    equipmentQualificationRequired: 0, annex11Reviews: 0, approved: 0, pendingReviews: 0,
  });
  const [charts, setCharts] = useState<CcValidationChartData>({
    impactDistribution: [], csvImpactTrend: [], qualificationTrend: [], revalidationTrend: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await fetchCcValidationListData();
    if ('error' in data && data.error) setError(data.error);
    setRows(data.assessments);
    setMetrics(data.metrics);
    setCharts(data.charts);
    setPending((data.changes || []).filter((c) =>
      (c.validation_impact || c.csv_impact)
      && !['closed', 'cancelled', 'rejected'].includes(c.status)
      && !data.assessments.some((a) => a.change_id === c.id && !a.is_deleted),
    ));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const columns = [
    { key: 'id', header: 'Assessment ID', render: (r: Row) => <span className="font-mono text-blue-600">{r.validation_assessment_id || r.id.slice(0, 8)}</span> },
    { key: 'cc', header: 'CC #', render: (r: Row) => <span className="font-mono">{r.change_control_number || r.change?.change_control_number || '—'}</span> },
    { key: 'title', header: 'Title', render: (r: Row) => <span className="max-w-[180px] truncate block">{r.change?.change_title || '—'}</span> },
    { key: 'cat', header: 'Category', render: (r: Row) => <CcValidationCategoryBadge category={r.validation_category} /> },
    { key: 'impacts', header: 'Impacts', render: (r: Row) => (
      <div className="flex flex-wrap gap-1">
        {r.validation_impact && <CcImpactBadge label="VAL" active />}
        {r.csv_impact && <CcImpactBadge label="CSV" active />}
        {r.revalidation_required && <CcImpactBadge label="REVAL" active />}
      </div>
    ) },
    { key: 'status', header: 'Status', render: (r: Row) => <CcValidationStatusBadge status={r.status} /> },
    { key: 'progress', header: 'Progress', render: (r: Row) => <CcValidationProgress assessment={r} /> },
    { key: 'due', header: 'Target Date', render: (r: Row) => r.target_completion_date || '—' },
    { key: 'actions', header: '', render: (r: Row) => (
      <Link href={`/qms/change-control/${r.change_id}/validation-assessment`}>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
      </Link>
    ) },
  ];

  const pendingColumns = [
    { key: 'cc', header: 'CC #', render: (r: ChangeControlRecord) => <span className="font-mono">{r.change_control_number}</span> },
    { key: 'title', header: 'Title', render: (r: ChangeControlRecord) => <span className="max-w-[200px] truncate block">{r.change_title}</span> },
    { key: 'val', header: 'Validation', render: (r: ChangeControlRecord) => <CcImpactBadge label="VAL" active={r.validation_impact} /> },
    { key: 'csv', header: 'CSV', render: (r: ChangeControlRecord) => <CcImpactBadge label="CSV" active={r.csv_impact} /> },
    { key: 'status', header: 'Status', render: (r: ChangeControlRecord) => <CcStatusBadge status={r.status} /> },
    { key: 'cat', header: 'Category', render: (r: ChangeControlRecord) => <CcRiskBadge category={r.change_category} /> },
    { key: 'actions', header: '', render: (r: ChangeControlRecord) => (
      <Link href={`/qms/change-control/${r.id}/validation-assessment`}>
        <Button size="sm" variant="outline">Start Assessment</Button>
      </Link>
    ) },
  ];

  return (
    <CcValidationAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Validation Assessment"
          description="Assess validation, qualification and CSV impact of proposed changes"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/change-control' },
            { label: 'Change Control', href: '/qms/change-control' },
            { label: 'Validation Assessment' },
          ]}
          actions={(
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh
            </Button>
          )}
        />

        {loading ? <LoadingSkeleton rows={6} /> : error ? <ErrorCard message={error} onRetry={() => void load()} /> : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Total Assessments" value={metrics.total} icon={ClipboardList} />
              <KpiCard label="Validation Required" value={metrics.validationRequired} icon={Target} accent="border-l-amber-500" />
              <KpiCard label="CSV Assessments" value={metrics.csvAssessments} icon={ShieldCheck} accent="border-l-indigo-600" />
              <KpiCard label="Revalidation Required" value={metrics.revalidationRequired} icon={AlertTriangle} accent="border-l-red-500" />
              <KpiCard label="Equipment Qualification" value={metrics.equipmentQualificationRequired} icon={CheckCircle2} accent="border-l-teal-600" />
              <KpiCard label="Annex 11 Reviews" value={metrics.annex11Reviews} icon={ShieldCheck} accent="border-l-purple-600" />
              <KpiCard label="Approved" value={metrics.approved} icon={CheckCircle2} accent="border-l-green-600" />
              <KpiCard label="Pending Reviews" value={metrics.pendingReviews} icon={Target} accent="border-l-amber-600" />
            </div>

            <CcValidationCharts charts={charts} />

            <Tabs defaultValue="assessments">
              <TabsList>
                <TabsTrigger value="assessments">All Assessments ({rows.length})</TabsTrigger>
                <TabsTrigger value="pending">Pending Queue ({pending.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="assessments" className="mt-4">
                {rows.length === 0 ? (
                  <EmptyState title="No validation assessments" message="Assessments will appear when validation impact reviews are initiated." />
                ) : (
                  <ResponsiveDataTable columns={columns} data={rows} mobileTitleKey="change_control_number" pageSize={15} />
                )}
              </TabsContent>
              <TabsContent value="pending" className="mt-4">
                {pending.length === 0 ? (
                  <EmptyState title="No pending changes" message="All changes requiring validation assessment have been started." />
                ) : (
                  <ResponsiveDataTable columns={pendingColumns} data={pending} mobileTitleKey="change_control_number" mobileSubtitleKey="change_title" pageSize={15} />
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </CcValidationAccessGuard>
  );
}
