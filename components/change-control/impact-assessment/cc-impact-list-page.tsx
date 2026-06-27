'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ClipboardList, Eye, FileCode2, GraduationCap, RefreshCw, ShieldCheck,
} from 'lucide-react';
import { fetchCcImpactListData } from '@/lib/cc-impact-service';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { KpiCard } from '@/components/admin/dashboard/kpi-card';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { CcStatusBadge } from '@/components/change-control/cc-sub-nav';
import { CcImpactAccessGuard } from './cc-impact-access-guard';
import { CcImpactRatingBadge, CcImpactStatusBadge } from './cc-impact-badges';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CcImpactDashboardMetrics, ChangeControlRecord, ChangeImpactAssessment } from '@/lib/change-control-types';

type Row = ChangeImpactAssessment & { change?: ChangeControlRecord | null };

export function CcImpactListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [pending, setPending] = useState<ChangeControlRecord[]>([]);
  const [metrics, setMetrics] = useState<CcImpactDashboardMetrics>({
    totalAssessments: 0, pendingReview: 0, approvedAssessments: 0, criticalImpactChanges: 0,
    validationImpactChanges: 0, csvImpactChanges: 0, trainingImpactChanges: 0, regulatoryImpactChanges: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await fetchCcImpactListData();
    if ('error' in data && data.error) setError(data.error);
    setRows(data.assessments);
    setMetrics(data.metrics);
    setPending(data.pending || []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const columns = [
    { key: 'id', header: 'Assessment ID', render: (r: Row) => <span className="font-mono text-blue-600">{r.impact_assessment_id || r.id.slice(0, 8)}</span> },
    { key: 'cc', header: 'CC #', render: (r: Row) => <span className="font-mono">{r.change_control_number || r.change?.change_control_number}</span> },
    { key: 'title', header: 'Title', render: (r: Row) => <span className="max-w-[180px] truncate block">{r.change?.change_title || '—'}</span> },
    { key: 'dept', header: 'Department', render: (r: Row) => r.department || '—' },
    { key: 'rating', header: 'Overall Impact', render: (r: Row) => <CcImpactRatingBadge rating={r.overall_impact_rating} /> },
    { key: 'status', header: 'Status', render: (r: Row) => <CcImpactStatusBadge status={r.status} /> },
    { key: 'date', header: 'Assessed', render: (r: Row) => r.assessment_date || r.assessed_at?.split('T')[0] || '—' },
    { key: 'actions', header: '', render: (r: Row) => (
      <Link href={`/qms/change-control/${r.change_id}/impact-assessment`}>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
      </Link>
    ) },
  ];

  const pendingColumns = [
    { key: 'cc', header: 'CC #', render: (r: ChangeControlRecord) => <span className="font-mono">{r.change_control_number}</span> },
    { key: 'title', header: 'Title', render: (r: ChangeControlRecord) => <span className="max-w-[200px] truncate block">{r.change_title}</span> },
    { key: 'dept', header: 'Department', render: (r: ChangeControlRecord) => r.department },
    { key: 'status', header: 'Status', render: (r: ChangeControlRecord) => <CcStatusBadge status={r.status} /> },
    { key: 'actions', header: '', render: (r: ChangeControlRecord) => (
      <Link href={`/qms/change-control/${r.id}/impact-assessment`}>
        <Button size="sm" variant="outline">Start Assessment</Button>
      </Link>
    ) },
  ];

  return (
    <CcImpactAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Change Impact Assessment"
          description="Evaluate GMP, quality, validation and regulatory impact of proposed changes"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/change-control' },
            { label: 'Change Control', href: '/qms/change-control' },
            { label: 'Impact Assessment' },
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
              <KpiCard label="Total" value={metrics.totalAssessments} icon={ClipboardList} accent="blue" />
              <KpiCard label="Pending Review" value={metrics.pendingReview} icon={ShieldCheck} accent="amber" />
              <KpiCard label="Approved" value={metrics.approvedAssessments} icon={CheckCircle2} accent="green" />
              <KpiCard label="Critical" value={metrics.criticalImpactChanges} icon={AlertTriangle} accent="red" />
              <KpiCard label="Validation" value={metrics.validationImpactChanges} icon={ShieldCheck} accent="purple" />
              <KpiCard label="CSV" value={metrics.csvImpactChanges} icon={FileCode2} accent="blue" />
              <KpiCard label="Training" value={metrics.trainingImpactChanges} icon={GraduationCap} accent="green" />
              <KpiCard label="Regulatory" value={metrics.regulatoryImpactChanges} icon={AlertTriangle} accent="orange" />
            </div>

            <Tabs defaultValue="assessments">
              <TabsList>
                <TabsTrigger value="assessments">Assessments</TabsTrigger>
                <TabsTrigger value="pending">Pending Queue</TabsTrigger>
              </TabsList>
              <TabsContent value="assessments" className="mt-4">
                {rows.length === 0 ? (
                  <EmptyState title="No impact assessments" message="Start from the pending queue." />
                ) : (
                  <ResponsiveDataTable columns={columns} data={rows} />
                )}
              </TabsContent>
              <TabsContent value="pending" className="mt-4">
                {pending.length === 0 ? (
                  <EmptyState title="Queue empty" message="No change controls pending impact assessment." />
                ) : (
                  <ResponsiveDataTable columns={pendingColumns} data={pending} />
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </CcImpactAccessGuard>
  );
}
