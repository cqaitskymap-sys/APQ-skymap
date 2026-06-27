'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Eye } from 'lucide-react';
import { fetchRiskClosureDashboard } from '@/lib/risk-closure-service';
import { computeRiskClosureReadiness } from '@/lib/risk-closure-records';
import type { RiskAssessmentRecord } from '@/lib/cpv-risk-assessment-records';
import type { RiskClosure } from '@/lib/risk-closure-records';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { KpiCard } from '@/components/admin/dashboard/kpi-card';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import { RiskClosureAccessGuard } from './risk-closure-access-guard';
import { RiskClosureStatusBadge, RiskAcceptanceBadge } from './risk-closure-ui';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle, CheckCircle2, Clock, RotateCcw, ShieldAlert, Target, XCircle,
} from 'lucide-react';

type Row = RiskClosure & { risk?: RiskAssessmentRecord | null; id: string };

export function RiskClosureListPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closures, setClosures] = useState<Row[]>([]);
  const [risks, setRisks] = useState<RiskAssessmentRecord[]>([]);
  const [metrics, setMetrics] = useState({
    readyForClosure: 0, pendingClosure: 0, closed: 0, rejected: 0,
    reopened: 0, highRiskClosures: 0, capaPendingClosures: 0, validationPendingClosures: 0,
  });

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const data = await fetchRiskClosureDashboard();
      if (data.error) setError(data.error);
      setClosures(data.closures as Row[]);
      setRisks(data.risks);
      setMetrics(data.metrics);
      setLoading(false);
    })();
  }, []);

  const readyRisks = useMemo(() => risks.filter((r) => {
    if (['Closed', 'Accepted', 'Rejected'].includes(r.riskStatus)) return false;
    return computeRiskClosureReadiness(r).ready;
  }), [risks]);

  const columns = [
    { key: 'risk_number', header: 'Risk No', render: (r: Row) => <span className="font-mono text-blue-600">{r.risk_number}</span> },
    { key: 'title', header: 'Title', render: (r: Row) => <span className="line-clamp-1 max-w-xs">{r.risk_title}</span> },
    { key: 'category', header: 'Category', render: (r: Row) => r.risk_category || '—' },
    { key: 'department', header: 'Department', render: (r: Row) => r.department || '—' },
    { key: 'status', header: 'Closure Status', render: (r: Row) => <RiskClosureStatusBadge status={r.closure_status} /> },
    { key: 'evaluation', header: 'Evaluation', render: (r: Row) => <RiskAcceptanceBadge evaluation={r.final_risk_evaluation} /> },
    { key: 'readiness', header: 'Readiness', render: (r: Row) => `${r.readiness_percent ?? 0}%` },
    { key: 'residual', header: 'Residual RPN', render: (r: Row) => r.residual_rpn ?? '—' },
    { key: 'actions', header: 'Action', render: (r: Row) => (
      <Link href={`/qms/risk-management/${r.risk_assessment_id}/closure`}>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
      </Link>
    ) },
  ];

  const readyColumns = [
    { key: 'risk_number', header: 'Risk No', render: (r: RiskAssessmentRecord) => <span className="font-mono text-blue-600">{r.riskNumber}</span> },
    { key: 'title', header: 'Title', render: (r: RiskAssessmentRecord) => <span className="line-clamp-1 max-w-xs">{r.parameterName || r.riskDescription}</span> },
    { key: 'category', header: 'Category', render: (r: RiskAssessmentRecord) => r.riskCategory },
    { key: 'level', header: 'Risk Level', render: (r: RiskAssessmentRecord) => r.riskLevel },
    { key: 'rpn', header: 'RPN', render: (r: RiskAssessmentRecord) => r.rpnScore },
    { key: 'owner', header: 'Owner', render: (r: RiskAssessmentRecord) => r.riskOwner },
    { key: 'status', header: 'Status', render: (r: RiskAssessmentRecord) => r.riskStatus },
    { key: 'actions', header: 'Action', render: (r: RiskAssessmentRecord) => (
      <Link href={`/qms/risk-management/${r.id}/closure`}>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
      </Link>
    ) },
  ];

  return (
    <RiskClosureAccessGuard>
      <div className="space-y-6">
        <CpvPageHeader
          title="Risk Closure"
          description="Final GMP and ICH Q9 risk closure review"
          trail={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'QMS', href: '/qms/risk-management/audit-trail' },
            { label: 'Risk Management', href: '/qms/risk-management/audit-trail' },
            { label: 'Closure' },
          ]}
        />

        {loading ? <LoadingSkeleton rows={2} /> : error ? (
          <ErrorCard title="Load error" message={error} />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
              <KpiCard label="Ready For Closure" value={metrics.readyForClosure} icon={Target} accent="border-l-teal-600" />
              <KpiCard label="Pending Closure" value={metrics.pendingClosure} icon={Clock} accent="border-l-amber-500" />
              <KpiCard label="Closed Risks" value={metrics.closed} icon={CheckCircle2} accent="border-l-green-600" />
              <KpiCard label="Rejected Closures" value={metrics.rejected} icon={XCircle} accent="border-l-red-500" />
              <KpiCard label="Reopened Risks" value={metrics.reopened} icon={RotateCcw} accent="border-l-orange-500" />
              <KpiCard label="High Risk Closures" value={metrics.highRiskClosures} icon={ShieldAlert} accent="border-l-purple-600" />
              <KpiCard label="CAPA Pending" value={metrics.capaPendingClosures} icon={AlertTriangle} accent="border-l-rose-500" />
              <KpiCard label="Validation Pending" value={metrics.validationPendingClosures} icon={AlertTriangle} accent="border-l-blue-600" />
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Ready For Closure</h2>
              {readyRisks.length ? (
                <ResponsiveDataTable
                  data={readyRisks.map((r) => ({ ...r, id: r.id }))}
                  columns={readyColumns}
                  searchKeys={['riskNumber', 'riskDescription', 'riskOwner']}
                />
              ) : (
                <EmptyState title="No risks ready" message="Complete mitigation, review, and effectiveness checks to enable closure." />
              )}
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Closure Records</h2>
              {closures.length ? (
                <ResponsiveDataTable
                  data={closures.map((c) => ({ ...c, id: c.id }))}
                  columns={columns}
                  searchKeys={['risk_number', 'risk_title', 'risk_owner']}
                />
              ) : (
                <EmptyState title="No closure records" message="Initiate closure from a risk assessment when ready." />
              )}
            </div>
          </>
        )}
      </div>
    </RiskClosureAccessGuard>
  );
}
